package com.stc.autotrade;

import com.getcapacitor.BridgeActivity;
import com.stc.autotrade.plugins.StcWebViewPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(StcWebViewPlugin.class);
        super.onCreate(savedInstanceState);
    }
}