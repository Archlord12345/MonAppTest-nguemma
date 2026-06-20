package com.wifiscanner

import android.content.Context
import android.net.wifi.WifiManager
import android.net.wifi.ScanResult
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.net.wifi.WifiNetworkSpecifier
import android.net.NetworkRequest
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.fbreact.specs.NativeWifiScannerSpec

class WifiScannerModule(reactContext: ReactApplicationContext) : NativeWifiScannerSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  @ReactMethod
  @Suppress("DEPRECATION")
  override fun scanWifi(promise: Promise) {
    val wifiManager = reactApplicationContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    
    val wifiScanReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        val results = try {
          wifiManager.scanResults
        } catch (e: SecurityException) {
          promise.reject("PERMISSION_DENIED", "Location permission is required to scan for WiFi networks")
          return
        }

        val wifiList: WritableArray = Arguments.createArray()
        
        if (results != null) {
          for (result in results) {
            @Suppress("DEPRECATION")
            val ssid = result.SSID
            if (!ssid.isNullOrEmpty()) {
              val wifiMap = Arguments.createMap()
              wifiMap.putString("SSID", ssid)
              wifiMap.putString("BSSID", result.BSSID)
              wifiMap.putInt("level", result.level)
              wifiMap.putInt("frequency", result.frequency)
              val caps = result.capabilities ?: ""
              wifiMap.putString("capabilities", caps)
              val security = when {
                caps.contains("WPA3") -> "WPA3"
                caps.contains("WPA2") -> "WPA2"
                caps.contains("WPA")  -> "WPA"
                caps.contains("WEP")  -> "WEP"
                else                  -> "Open"
              }
              wifiMap.putString("security", security)
              wifiList.pushMap(wifiMap)
            }
          }
        }
        try {
          reactApplicationContext.unregisterReceiver(this)
        } catch (e: Exception) {
          // Ignore if already unregistered
        }
        promise.resolve(wifiList)
      }
    }

    val intentFilter = IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION)
    
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactApplicationContext.registerReceiver(wifiScanReceiver, intentFilter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      reactApplicationContext.registerReceiver(wifiScanReceiver, intentFilter)
    }

    @Suppress("DEPRECATION")
    val success = try {
      wifiManager.startScan()
    } catch (e: SecurityException) {
      promise.reject("PERMISSION_DENIED", "Location permission is required to scan for WiFi networks")
      return
    }

    if (!success) {
      // Unregister if scan failed to start immediately
      try {
        reactApplicationContext.unregisterReceiver(wifiScanReceiver)
      } catch (e: Exception) {}

      // Return current results
      @Suppress("DEPRECATION")
      val results = try { wifiManager.scanResults } catch (e: SecurityException) { null }
      val wifiList: WritableArray = Arguments.createArray()
      results?.forEach { result ->
        @Suppress("DEPRECATION")
        val ssid = result.SSID
        if (!ssid.isNullOrEmpty()) {
          val wifiMap = Arguments.createMap()
          wifiMap.putString("SSID", ssid)
          wifiMap.putString("BSSID", result.BSSID)
          wifiMap.putInt("level", result.level)
          wifiMap.putInt("frequency", result.frequency)
          val caps = result.capabilities ?: ""
          wifiMap.putString("capabilities", caps)
          val security = when {
            caps.contains("WPA3") -> "WPA3"
            caps.contains("WPA2") -> "WPA2"
            caps.contains("WPA")  -> "WPA"
            caps.contains("WEP")  -> "WEP"
            else                  -> "Open"
          }
          wifiMap.putString("security", security)
          wifiList.pushMap(wifiMap)
        }
      }
      promise.resolve(wifiList)
    }
  }

  @ReactMethod
  override fun connectToWifi(ssid: String, password: String, promise: Promise) {
    try {
      val connectivityManager = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val specifier = WifiNetworkSpecifier.Builder()
          .setSsid(ssid)
          .setWpa2Passphrase(password)
          .build()

        val request = NetworkRequest.Builder()
          .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
          .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_RESTRICTED)
          .setNetworkSpecifier(specifier)
          .build()

        connectivityManager.requestNetwork(request, object : ConnectivityManager.NetworkCallback() {
          override fun onAvailable(network: Network) {
            super.onAvailable(network)
            connectivityManager.bindProcessToNetwork(network)
            promise.resolve(true)
          }

          override fun onUnavailable() {
            super.onUnavailable()
            promise.resolve(false)
          }

          override fun onLost(network: Network) {
            super.onLost(network)
            connectivityManager.bindProcessToNetwork(null)
          }
        })
      } else {
        promise.reject("UNSUPPORTED", "Android version below Q is not supported for this method")
      }
    } catch (e: Exception) {
      promise.reject("CONNECT_ERROR", e.message)
    }
  }

  companion object {
    const val NAME = "WifiScanner"
  }
}
