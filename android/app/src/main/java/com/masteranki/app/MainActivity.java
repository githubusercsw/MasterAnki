package com.masteranki.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.masteranki.app.plugins.AnkiDroidPlugin;
import com.masteranki.app.plugins.InboxPlugin;
import com.masteranki.app.plugins.LogPlugin;
import com.masteranki.app.plugins.SettingsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InboxPlugin.class);
        registerPlugin(AnkiDroidPlugin.class);
        registerPlugin(SettingsPlugin.class);
        registerPlugin(LogPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
