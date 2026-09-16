package com.routehub.driver;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceAccessPlugin.class);
        super.onCreate(savedInstanceState);
        ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (view, insets) -> {
            WindowInsetsCompat bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
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
