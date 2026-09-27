package com.boreal.risk.client;
import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle savedInstanceState) {
    registerPlugin(BackgroundSyncPlugin.class); // BI_CLIENT_BACKGROUND_SYNC_v308
    registerPlugin(SharedFilesPlugin.class); // BI_CLIENT_BLOCK_v554_SHARE_TO_BOREAL
    registerPlugin(ClientWidgetPlugin.class); // BI_CLIENT_BLOCK_v603_HOME_WIDGET
    super.onCreate(savedInstanceState);
  }
}
