package com.routehub.driver;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(DeviceAccessPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
