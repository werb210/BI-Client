package com.boreal.risk.client;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import java.util.Arrays;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name = "ClientWidget")
public class ClientWidgetPlugin extends Plugin {
  static final String PREFS="boreal_client_widget", STAGE="stage", COUNT="todo_count";
  @com.getcapacitor.PluginMethod public void update(PluginCall call) {
    String stage=call.getString("stage", "Application in progress"); int count=Math.max(0,Math.min(99,call.getInt("toDoCount",0)));
    getContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString(STAGE,stage).putInt(COUNT,count).apply();
    refresh(getContext()); publishShortcuts(stage,count); call.resolve();
  }
  @com.getcapacitor.PluginMethod public void clear(PluginCall call) {
    getContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().clear().apply(); refresh(getContext()); publishShortcuts("Application in progress",0); call.resolve();
  }
  static void refresh(Context c) { AppWidgetManager m=AppWidgetManager.getInstance(c); int[] ids=m.getAppWidgetIds(new ComponentName(c,ClientWidgetProvider.class)); Intent i=new Intent(c,ClientWidgetProvider.class).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE); i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS,ids); c.sendBroadcast(i); }
  private void publishShortcuts(String stage,int count) {
    if(Build.VERSION.SDK_INT<Build.VERSION_CODES.N_MR1)return; ShortcutManager m=getContext().getSystemService(ShortcutManager.class);
    ShortcutInfo status=new ShortcutInfo.Builder(getContext(),"application_status").setShortLabel("Application status").setLongLabel(stage+" · "+count+" to do").setIcon(Icon.createWithResource(getContext(),R.mipmap.ic_launcher)).setIntent(new Intent(Intent.ACTION_VIEW,Uri.parse("borealrisk://home"),getContext(),MainActivity.class)).build();
    ShortcutInfo upload=new ShortcutInfo.Builder(getContext(),"upload_document").setShortLabel("Upload document").setLongLabel("Upload a requested document").setIcon(Icon.createWithResource(getContext(),R.mipmap.ic_launcher)).setIntent(new Intent(Intent.ACTION_VIEW,Uri.parse("borealrisk://upload"),getContext(),MainActivity.class)).build(); m.setDynamicShortcuts(Arrays.asList(status,upload));
  }
}
