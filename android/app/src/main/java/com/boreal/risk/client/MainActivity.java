package com.boreal.risk.client;
import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle savedInstanceState) {
    registerPlugin(BackgroundSyncPlugin.class); // BI_CLIENT_BACKGROUND_SYNC_v308
    super.onCreate(savedInstanceState);
  }
}
