package com.boreal.risk.client;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.util.Iterator;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

// BI_CLIENT_BACKGROUND_SYNC_v308 - WorkManager sends prepared requests after the app is closed.
@CapacitorPlugin(name = "BackgroundSync")
public class BackgroundSyncPlugin extends Plugin {
  static final String PREFS = "boreal_background_sync";
  static final String TAG = "boreal-background-sync";

  static File directory(Context context) {
    File dir = new File(context.getFilesDir(), "background-sync");
    if (!dir.exists()) dir.mkdirs();
    return dir;
  }

  static void record(Context context, String id, int status) {
    try {
      SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
      JSONObject all = new JSONObject(prefs.getString("results", "{}"));
      all.put(id, status);
      prefs.edit().putString("results", all.toString()).apply();
    } catch (Exception ignored) { }
  }

  @PluginMethod
  public void enqueue(PluginCall call) {
    String id = call.getString("id");
    String url = call.getString("url");
    String bodyBase64 = call.getString("bodyBase64");
    if (id == null || url == null || bodyBase64 == null) { call.reject("id, url and bodyBase64 are required"); return; }
    try {
      File bodyFile = new File(directory(getContext()), id + ".body");
      try (FileOutputStream out = new FileOutputStream(bodyFile)) {
        out.write(Base64.decode(bodyBase64, Base64.DEFAULT));
      }
      Data input = new Data.Builder()
        .putString("id", id)
        .putString("url", url)
        .putString("method", call.getString("method", "POST"))
        .putString("contentType", call.getString("contentType", "application/json"))
        .putString("bodyPath", bodyFile.getAbsolutePath())
        .putString("headers", call.getObject("headers", new JSObject()).toString())
        .build();
      OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(BackgroundSyncWorker.class)
        .setInputData(input)
        .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        .addTag(TAG)
        .build();
      WorkManager.getInstance(getContext()).enqueueUniqueWork(id, ExistingWorkPolicy.KEEP, request);
      call.resolve();
    } catch (Exception error) {
      call.reject("Could not start the background send", error);
    }
  }

  @PluginMethod
  public void results(PluginCall call) {
    JSArray list = new JSArray();
    try {
      JSONObject all = new JSONObject(getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("results", "{}"));
      Iterator<String> keys = all.keys();
      while (keys.hasNext()) {
        String key = keys.next();
        JSObject item = new JSObject();
        item.put("id", key);
        item.put("status", all.optInt(key, 0));
        list.put(item);
      }
    } catch (Exception ignored) { }
    JSObject result = new JSObject();
    result.put("results", list);
    call.resolve(result);
  }

  @PluginMethod
  public void acknowledge(PluginCall call) {
    try {
      JSArray ids = call.getArray("ids", new JSArray());
      SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
      JSONObject all = new JSONObject(prefs.getString("results", "{}"));
      for (int i = 0; i < ids.length(); i++) all.remove(ids.getString(i));
      prefs.edit().putString("results", all.toString()).apply();
    } catch (Exception ignored) { }
    call.resolve();
  }

  @PluginMethod
  public void cancelAll(PluginCall call) {
    WorkManager.getInstance(getContext()).cancelAllWorkByTag(TAG);
    File[] files = directory(getContext()).listFiles();
    if (files != null) for (File f : files) f.delete();
    getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("results").apply();
    call.resolve();
  }
}
