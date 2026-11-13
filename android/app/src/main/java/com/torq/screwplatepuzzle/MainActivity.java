package com.torq.screwplatepuzzle;

import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.RatingBar;
import android.widget.TextView;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.nativead.MediaView;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdOptions;
import com.google.android.gms.ads.nativead.NativeAdView;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "TorqNativeAds";
    // Official Google AdMob Native Advanced Test Ad Unit ID for Android
    private static final String TEST_NATIVE_AD_UNIT_ID = "ca-app-pub-3940256099942544/2247696110";

    private FrameLayout nativeAdsOverlay;
    private NativeAdView leftNativeAdView;
    private NativeAdView rightNativeAdView;
    private NativeAd loadedLeftAd;
    private NativeAd loadedRightAd;
    private volatile boolean adsAllowedByFtue = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayGamesCloudSavePlugin.class);
        super.onCreate(savedInstanceState);
        enableImmersiveMode();
        setupNativeAdsOverlay();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableImmersiveMode();
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        updateOverlayVisibility(newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE);
    }

    public void setNativeAdsAllowedByFtue(boolean allowed) {
        if (getIntent() != null && getIntent().getBooleanExtra("no_ads", false)) {
            allowed = false;
        }
        adsAllowedByFtue = allowed;
        runOnUiThread(() -> {
            boolean isLandscape = getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
            updateOverlayVisibility(isLandscape);
        });
    }

    private void updateOverlayVisibility(boolean isLandscape) {
        if (nativeAdsOverlay != null) {
            boolean suppress = getIntent() != null && getIntent().getBooleanExtra("no_ads", false);
            nativeAdsOverlay.setVisibility((isLandscape && adsAllowedByFtue && !suppress) ? View.VISIBLE : View.GONE);
        }
    }

    private void setupNativeAdsOverlay() {
        runOnUiThread(() -> {
            ViewGroup rootView = findViewById(android.R.id.content);
            if (rootView == null)
                return;

            nativeAdsOverlay = new FrameLayout(this) {
                @Override
                public boolean onTouchEvent(android.view.MotionEvent event) {
                    // Pass touches outside ad cards down to the WebView
                    return false;
                }
            };
            FrameLayout.LayoutParams overlayParams = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT);
            // Hidden by default during FTUE L1-L3 until unlocked after Level 3 win
            nativeAdsOverlay.setVisibility(View.GONE);
            rootView.addView(nativeAdsOverlay, overlayParams);

            LayoutInflater inflater = LayoutInflater.from(this);

            // Left Native Ad View (Flanking Workbench on Left Empty Space)
            leftNativeAdView = (NativeAdView) inflater.inflate(R.layout.admob_native_card, nativeAdsOverlay, false);
            FrameLayout.LayoutParams leftParams = new FrameLayout.LayoutParams(
                    dpToPx(188),
                    FrameLayout.LayoutParams.WRAP_CONTENT);
            leftParams.gravity = Gravity.START | Gravity.CENTER_VERTICAL;
            leftParams.leftMargin = dpToPx(8);
            leftNativeAdView.setVisibility(View.GONE);
            nativeAdsOverlay.addView(leftNativeAdView, leftParams);

            // Right Native Ad View (Flanking Workbench on Right Empty Space)
            rightNativeAdView = (NativeAdView) inflater.inflate(R.layout.admob_native_card, nativeAdsOverlay, false);
            FrameLayout.LayoutParams rightParams = new FrameLayout.LayoutParams(
                    dpToPx(188),
                    FrameLayout.LayoutParams.WRAP_CONTENT);
            rightParams.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
            rightParams.rightMargin = dpToPx(8);
            rightNativeAdView.setVisibility(View.GONE);
            nativeAdsOverlay.addView(rightNativeAdView, rightParams);

            try {
                MobileAds.initialize(this, initializationStatus -> {
                    Log.d(TAG, "Google Mobile Ads SDK initialized, loading official Native Advanced ads");
                    loadLeftNativeAd();
                    loadRightNativeAd();
                });
            } catch (Throwable t) {
                Log.w(TAG, "MobileAds.initialize deferred or failed: " + t.getMessage());
            }
        });
    }

    private void loadLeftNativeAd() {
        AdLoader adLoader = new AdLoader.Builder(this, TEST_NATIVE_AD_UNIT_ID)
                .forNativeAd(nativeAd -> {
                    if (isDestroyed() || isFinishing()) {
                        nativeAd.destroy();
                        return;
                    }
                    if (loadedLeftAd != null) {
                        loadedLeftAd.destroy();
                    }
                    loadedLeftAd = nativeAd;
                    populateNativeAdView(nativeAd, leftNativeAdView);
                })
                .withAdListener(new AdListener() {
                    @Override
                    public void onAdFailedToLoad(LoadAdError loadAdError) {
                        Log.w(TAG, "Left Google Native Ad failed to load: " + loadAdError.getMessage());
                    }
                })
                .withNativeAdOptions(new NativeAdOptions.Builder()
                        .setMediaAspectRatio(NativeAdOptions.NATIVE_MEDIA_ASPECT_RATIO_LANDSCAPE)
                        .build())
                .build();

        adLoader.loadAd(new AdRequest.Builder().build());
    }

    private void loadRightNativeAd() {
        AdLoader adLoader = new AdLoader.Builder(this, TEST_NATIVE_AD_UNIT_ID)
                .forNativeAd(nativeAd -> {
                    if (isDestroyed() || isFinishing()) {
                        nativeAd.destroy();
                        return;
                    }
                    if (loadedRightAd != null) {
                        loadedRightAd.destroy();
                    }
                    loadedRightAd = nativeAd;
                    populateNativeAdView(nativeAd, rightNativeAdView);
                })
                .withAdListener(new AdListener() {
                    @Override
                    public void onAdFailedToLoad(LoadAdError loadAdError) {
                        Log.w(TAG, "Right Google Native Ad failed to load: " + loadAdError.getMessage());
                    }
                })
                .withNativeAdOptions(new NativeAdOptions.Builder()
                        .setMediaAspectRatio(NativeAdOptions.NATIVE_MEDIA_ASPECT_RATIO_LANDSCAPE)
                        .build())
                .build();

        adLoader.loadAd(new AdRequest.Builder().build());
    }

    private void populateNativeAdView(NativeAd nativeAd, NativeAdView adView) {
        adView.setHeadlineView(adView.findViewById(R.id.ad_headline));
        adView.setBodyView(adView.findViewById(R.id.ad_body));
        adView.setCallToActionView(adView.findViewById(R.id.ad_call_to_action));
        adView.setIconView(adView.findViewById(R.id.ad_app_icon));
        adView.setMediaView(adView.findViewById(R.id.ad_media));
        adView.setStarRatingView(adView.findViewById(R.id.ad_stars));
        adView.setAdvertiserView(adView.findViewById(R.id.ad_advertiser));

        TextView headlineView = (TextView) adView.getHeadlineView();
        if (headlineView != null) {
            headlineView.setText(nativeAd.getHeadline());
        }

        TextView bodyView = (TextView) adView.getBodyView();
        if (bodyView != null) {
            if (nativeAd.getBody() == null) {
                bodyView.setVisibility(View.GONE);
            } else {
                bodyView.setVisibility(View.VISIBLE);
                bodyView.setText(nativeAd.getBody());
            }
        }

        Button ctaView = (Button) adView.getCallToActionView();
        if (ctaView != null) {
            if (nativeAd.getCallToAction() == null) {
                ctaView.setVisibility(View.GONE);
            } else {
                ctaView.setVisibility(View.VISIBLE);
                ctaView.setText(nativeAd.getCallToAction());
            }
        }

        ImageView iconView = (ImageView) adView.getIconView();
        if (iconView != null) {
            if (nativeAd.getIcon() == null) {
                iconView.setVisibility(View.GONE);
            } else {
                iconView.setImageDrawable(nativeAd.getIcon().getDrawable());
                iconView.setVisibility(View.VISIBLE);
            }
        }

        MediaView mediaView = adView.getMediaView();
        if (mediaView != null && nativeAd.getMediaContent() != null) {
            mediaView.setMediaContent(nativeAd.getMediaContent());
        }

        RatingBar starRatingView = (RatingBar) adView.getStarRatingView();
        if (starRatingView != null) {
            if (nativeAd.getStarRating() == null) {
                starRatingView.setVisibility(View.GONE);
            } else {
                starRatingView.setRating(nativeAd.getStarRating().floatValue());
                starRatingView.setVisibility(View.VISIBLE);
            }
        }

        TextView advertiserView = (TextView) adView.getAdvertiserView();
        if (advertiserView != null) {
            if (nativeAd.getAdvertiser() == null) {
                advertiserView.setVisibility(View.GONE);
            } else {
                advertiserView.setText(nativeAd.getAdvertiser());
                advertiserView.setVisibility(View.VISIBLE);
            }
        }

        adView.setNativeAd(nativeAd);
        boolean suppress = getIntent() != null && getIntent().getBooleanExtra("no_ads", false);
        adView.setVisibility((adsAllowedByFtue && !suppress) ? View.VISIBLE : View.GONE);
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }

    @Override
    public void onDestroy() {
        if (loadedLeftAd != null) {
            loadedLeftAd.destroy();
        }
        if (loadedRightAd != null) {
            loadedRightAd.destroy();
        }
        super.onDestroy();
    }

    private void enableImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }
}
