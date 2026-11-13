package com.torq.screwplatepuzzle;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.PlayersClient;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadata;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "PlayGamesCloudSave")
public class PlayGamesCloudSavePlugin extends Plugin {
    private static final String TAG = "PlayGamesCloudSave";
    private static final String DEFAULT_SNAPSHOT_NAME = "torq_saved_game_primary";
    private static final String PREFS_NAME = "torq_pgs_prefs";
    private static final String KEY_PGS_LINKED = "pgs_previously_linked";
    private boolean sdkInitialized = false;

    @Override
    public void load() {
        super.load();
        // Eagerly initialize Google Play Games SDK on app launch for automatic silent sign-in & cloud restore
        ensureSdkInitialized();
    }

    private boolean isPreviouslyLinked() {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            return prefs.getBoolean(KEY_PGS_LINKED, false);
        } catch (Exception ignored) {
            return false;
        }
    }

    private void markPreviouslyLinked(boolean linked) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(KEY_PGS_LINKED, linked).apply();
        } catch (Exception ignored) {
        }
    }

    private void ensureSdkInitialized() {
        if (sdkInitialized)
            return;
        try {
            PlayGamesSdk.initialize(getContext());
            sdkInitialized = true;
            Log.d(TAG, "PlayGamesSdk initialized lazily");
        } catch (Exception e) {
            Log.w(TAG, "Failed to initialize PlayGamesSdk: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setNativeAdsVisible(PluginCall call) {
        boolean visible = Boolean.TRUE.equals(call.getBoolean("visible", false));
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).setNativeAdsAllowedByFtue(visible);
        }
        JSObject ret = new JSObject();
        ret.put("visible", visible);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkAuthStatus(PluginCall call) {
        try {
            if (getActivity() != null && getActivity().getIntent() != null && getActivity().getIntent().getBooleanExtra("no_ads", false)) {
                JSObject ret = new JSObject();
                ret.put("isAuthenticated", false);
                call.resolve(ret);
                return;
            }
            ensureSdkInitialized();
            GamesSignInClient signInClient = PlayGames.getGamesSignInClient(getActivity());
            signInClient.isAuthenticated().addOnCompleteListener(task -> {
                if (task.isSuccessful() && task.getResult() != null && task.getResult().isAuthenticated()) {
                    resolveAuthenticatedPlayer(call);
                    return;
                }
                // Automatic background sign-in: attempt silent sign-in so user does not need to click anything
                signInClient.signIn().addOnCompleteListener(signInTask -> {
                    if (signInTask.isSuccessful() && signInTask.getResult() != null
                            && signInTask.getResult().isAuthenticated()) {
                        resolveAuthenticatedPlayer(call);
                    } else {
                        JSObject ret = new JSObject();
                        ret.put("isAuthenticated", false);
                        call.resolve(ret);
                    }
                });
            });
        } catch (Exception e) {
            Log.e(TAG, "checkAuthStatus error: " + e.getMessage(), e);
            JSObject ret = new JSObject();
            ret.put("isAuthenticated", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    private void resolveAuthenticatedPlayer(PluginCall call) {
        markPreviouslyLinked(true);
        JSObject ret = new JSObject();
        PlayersClient playersClient = PlayGames.getPlayersClient(getActivity());
        playersClient.getCurrentPlayer().addOnCompleteListener(playerTask -> {
            ret.put("isAuthenticated", true);
            if (playerTask.isSuccessful() && playerTask.getResult() != null) {
                ret.put("playerId", playerTask.getResult().getPlayerId());
                ret.put("displayName", playerTask.getResult().getDisplayName());
            } else {
                ret.put("playerId", "pgs_player");
                ret.put("displayName", "Play Games Player");
            }
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void loadSave(PluginCall call) {
        String snapshotName = call.getString("snapshotName", DEFAULT_SNAPSHOT_NAME);
        try {
            SnapshotsClient snapshotsClient = PlayGames.getSnapshotsClient(getActivity());
            snapshotsClient.open(snapshotName, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED)
                    .addOnCompleteListener(task -> {
                        JSObject ret = new JSObject();
                        if (!task.isSuccessful() || task.getResult() == null) {
                            ret.put("success", false);
                            ret.put("error", task.getException() != null ? task.getException().getMessage()
                                    : "Unknown snapshot open error");
                            call.resolve(ret);
                            return;
                        }

                        SnapshotsClient.DataOrConflict<Snapshot> result = task.getResult();
                        if (result.isConflict()) {
                            // Conflict detected! Expose both versions to client
                            try {
                                SnapshotsClient.SnapshotConflict conflict = result.getConflict();
                                Snapshot serverSnapshot = conflict.getSnapshot();
                                Snapshot resolvingSnapshot = conflict.getConflictingSnapshot();

                                byte[] serverBytes = serverSnapshot.getSnapshotContents().readFully();
                                byte[] resolvingBytes = resolvingSnapshot.getSnapshotContents().readFully();

                                ret.put("success", true);
                                ret.put("hasConflict", true);
                                ret.put("conflictId", conflict.getConflictId());
                                ret.put("cloudData", new String(serverBytes, StandardCharsets.UTF_8));
                                ret.put("localData", new String(resolvingBytes, StandardCharsets.UTF_8));
                                ret.put("cloudLastModified", serverSnapshot.getMetadata().getLastModifiedTimestamp());
                                ret.put("localLastModified",
                                        resolvingSnapshot.getMetadata().getLastModifiedTimestamp());
                                call.resolve(ret);
                                return;
                            } catch (IOException e) {
                                Log.e(TAG, "Error reading conflict data: " + e.getMessage(), e);
                            }
                        }

                        Snapshot snapshot = result.getData();
                        if (snapshot == null) {
                            ret.put("success", true);
                            ret.put("empty", true);
                            call.resolve(ret);
                            return;
                        }

                        try {
                            byte[] rawBytes = snapshot.getSnapshotContents().readFully();
                            if (rawBytes == null || rawBytes.length == 0) {
                                ret.put("success", true);
                                ret.put("empty", true);
                            } else {
                                ret.put("success", true);
                                ret.put("empty", false);
                                ret.put("hasConflict", false);
                                ret.put("data", new String(rawBytes, StandardCharsets.UTF_8));
                                SnapshotMetadata meta = snapshot.getMetadata();
                                if (meta != null) {
                                    ret.put("description", meta.getDescription());
                                    ret.put("lastModified", meta.getLastModifiedTimestamp());
                                    ret.put("playedTimeMs", meta.getPlayedTime());
                                }
                            }
                            call.resolve(ret);
                        } catch (IOException e) {
                            Log.e(TAG, "Error reading snapshot contents: " + e.getMessage(), e);
                            ret.put("success", false);
                            ret.put("error", e.getMessage());
                            call.resolve(ret);
                        }
                    });
        } catch (Exception e) {
            Log.e(TAG, "loadSave error: " + e.getMessage(), e);
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void commitSave(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Data string is required for commitSave");
            return;
        }

        String snapshotName = call.getString("snapshotName", DEFAULT_SNAPSHOT_NAME);
        String description = call.getString("description", "TORQ Puzzle Progress");
        long playedTimeMs = call.getInt("playedTimeMs", 0);

        try {
            SnapshotsClient snapshotsClient = PlayGames.getSnapshotsClient(getActivity());
            snapshotsClient.open(snapshotName, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED)
                    .addOnCompleteListener(task -> {
                        JSObject ret = new JSObject();
                        if (!task.isSuccessful() || task.getResult() == null) {
                            ret.put("success", false);
                            ret.put("error", task.getException() != null ? task.getException().getMessage()
                                    : "Snapshot open failed");
                            call.resolve(ret);
                            return;
                        }

                        Snapshot snapshot = task.getResult().getData();
                        if (snapshot == null) {
                            ret.put("success", false);
                            ret.put("error", "Snapshot is null");
                            call.resolve(ret);
                            return;
                        }

                        try {
                            byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
                            snapshot.getSnapshotContents().writeBytes(bytes);

                            SnapshotMetadataChange.Builder metaBuilder = new SnapshotMetadataChange.Builder()
                                    .setDescription(description);
                            if (playedTimeMs > 0) {
                                metaBuilder.setPlayedTimeMillis(playedTimeMs);
                            }

                            snapshotsClient.commitAndClose(snapshot, metaBuilder.build())
                                    .addOnCompleteListener(commitTask -> {
                                        if (commitTask.isSuccessful()) {
                                            Log.d(TAG, "Successfully committed save to Google Play Games Services: "
                                                    + description);
                                            ret.put("success", true);
                                        } else {
                                            Log.w(TAG, "Failed committing save to Play Games Services");
                                            ret.put("success", false);
                                            ret.put("error",
                                                    commitTask.getException() != null
                                                            ? commitTask.getException().getMessage()
                                                            : "Commit failed");
                                        }
                                        call.resolve(ret);
                                    });
                        } catch (Exception e) {
                            Log.e(TAG, "Error writing snapshot bytes: " + e.getMessage(), e);
                            ret.put("success", false);
                            ret.put("error", e.getMessage());
                            call.resolve(ret);
                        }
                    });
        } catch (Exception e) {
            Log.e(TAG, "commitSave exception: " + e.getMessage(), e);
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }
}
