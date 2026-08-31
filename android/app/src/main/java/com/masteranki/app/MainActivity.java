package com.masteranki.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.masteranki.app.plugins.AnkiDroidPlugin;
import com.masteranki.app.plugins.InboxPlugin;
import com.masteranki.app.plugins.LogPlugin;
import com.masteranki.app.plugins.SettingsPlugin;
import com.masteranki.app.plugins.ShareReceiverPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InboxPlugin.class);
        registerPlugin(AnkiDroidPlugin.class);
        registerPlugin(SettingsPlugin.class);
        registerPlugin(LogPlugin.class);
        registerPlugin(ShareReceiverPlugin.class);
        super.onCreate(savedInstanceState);
        // 冷启动分享进入：消费启动 intent（热启动由 Bridge 自动分发 handleOnNewIntent）
        ShareReceiverPlugin share = (ShareReceiverPlugin) getBridge().getPlugin("ShareReceiver").getInstance();
        share.consumeIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // Bridge.onNewIntent 会遍历插件调用 handleOnNewIntent，无需手动转发
    }
}
