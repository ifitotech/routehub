package com.routehub.driver;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceAccessPlugin.class);
        super.onCreate(savedInstanceState);
        // Android's WebView can algorithmically re-darken web content that
        // does not opt out, independent of any specific CSS rule - this is
        // what was turning navy loading screens greenish on-device even
        // after removing every gradient layer from them. RouteHub already
        // ships its own dark theme (data-theme + color-scheme), so the
        // WebView's own heuristic re-darkening is redundant and only
        // introduces this kind of color drift.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(getBridge().getWebView().getSettings(), false);
        }
        ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            String script = "document.documentElement.style.setProperty('--android-safe-top','" + bars.top
                    + "px');document.documentElement.style.setProperty('--android-safe-bottom','" + bars.bottom
                    + "px');document.documentElement.style.setProperty('--android-safe-left','" + bars.left
                    + "px');document.documentElement.style.setProperty('--android-safe-right','" + bars.right + "px');";
            ((WebView) view).evaluateJavascript(script, null);
            return insets;
        });
        ViewCompat.requestApplyInsets(getBridge().getWebView());
    }
}
