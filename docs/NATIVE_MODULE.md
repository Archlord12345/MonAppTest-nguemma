# 🔧 Documentation Technique — Module Natif WifiScanner

Ce document détaille le fonctionnement interne du module natif Kotlin `WifiScanner` et explique comment l'étendre ou le déboguer.

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture TurboModule](#architecture-turbomodule)
3. [Flux de données](#flux-de-données)
4. [Référence des fichiers](#référence-des-fichiers)
5. [Comment ajouter une nouvelle fonction native](#comment-ajouter-une-nouvelle-fonction-native)
6. [Build Android — Détails techniques](#build-android--détails-techniques)
7. [Patches appliqués](#patches-appliqués)

---

## Vue d'ensemble

```
JavaScript (React Native)
        │
        │  appel Promise
        ▼
NativeWifiScanner.ts          ← Spécification TypeScript (interface)
        │
        │  TurboModule / JSI bridge
        ▼
WifiScannerModule.kt          ← Implémentation Android native (Kotlin)
        │
        │  Android SDK APIs
        ▼
WifiManager / ConnectivityManager
```

---

## Architecture TurboModule

L'architecture **Nouvelle Architecture** de React Native 0.76+ utilise le système **TurboModules** à la place des anciens NativeModules. La différence principale :

| Ancien système | TurboModule (nouvelle archi) |
|---|---|
| Bridge asynchrone JSON | JSI — appels synchrones possibles |
| Chargement au démarrage | Chargement paresseux (lazy) |
| Pas de type safety | Types stricts via la spec |

### Fichiers impliqués dans la liaison JS ↔ Kotlin

```
src/NativeWifiScanner.ts          ← Spec TypeScript (source de vérité)
        │
        │  React Native Codegen génère automatiquement :
        ▼
android/build/generated/source/codegen/jni/
  ├── WifiScannerSpec.h            ← En-tête C++ généré
  ├── WifiScannerSpec-generated.cpp
  └── react/renderer/components/WifiScannerSpec/
        ├── Props.cpp, EventEmitters.cpp…

android/build/generated/source/codegen/java/
  └── com/facebook/fbreact/specs/
        └── NativeWifiScannerSpec.java   ← Classe abstraite Java générée
                │
                │ héritée par
                ▼
        WifiScannerModule.kt             ← Notre implémentation Kotlin
```

---

## Flux de données

### Scan Wi-Fi — étape par étape

```
App.tsx : scan()
    │
    ├─ 1. Demande permissions Android
    │
    ├─ 2. Appelle scanWifi() [src/index.tsx]
    │         │
    │         └─ Appelle WifiScanner?.scanWifi() [NativeWifiScanner.ts]
    │                   │
    │                   └─ Pont JSI → WifiScannerModule.kt
    │
    └─ 3. WifiScannerModule.kt :
              │
              ├─ Obtient WifiManager
              ├─ Crée BroadcastReceiver pour SCAN_RESULTS_AVAILABLE_ACTION
              ├─ Enregistre le receiver
              ├─ Appelle wifiManager.startScan()
              │
              ├─ [Callback] onReceive() :
              │     ├─ Récupère wifiManager.scanResults
              │     ├─ Pour chaque réseau :
              │     │    ├─ SSID, BSSID, level, frequency
              │     │    ├─ capabilities (chaîne brute)
              │     │    └─ security (dérivé des capabilities)
              │     ├─ Désenregistre le BroadcastReceiver
              │     └─ promise.resolve(wifiList)
              │
              └─ [Si startScan() échoue] → retourne scanResults en cache
```

### Interprétation du champ `security`

```kotlin
val security = when {
  caps.contains("WPA3") -> "WPA3"   // Le plus sécurisé
  caps.contains("WPA2") -> "WPA2"   // Standard actuel
  caps.contains("WPA")  -> "WPA"    // Ancien standard
  caps.contains("WEP")  -> "WEP"    // Très faible (ne plus utiliser)
  else                  -> "Open"   // Aucun chiffrement !
}
```

> **Note** : L'ordre est important — on vérifie WPA3 avant WPA2, car un réseau WPA3 peut contenir "WPA2" dans sa chaîne de capabilities.

### Interprétation du champ `level` (dBm)

| Plage dBm | Qualité | Barres |
|---|---|---|
| ≥ -50 dBm | Excellent | ████ |
| -50 à -65 dBm | Bon | ███░ |
| -65 à -75 dBm | Moyen | ██░░ |
| -75 à -85 dBm | Faible | █░░░ |
| < -85 dBm | Très faible | ░░░░ |

### Interprétation du champ `frequency` (MHz)

| Fréquence | Bande | Caractéristiques |
|---|---|---|
| 2400–2483 MHz | **2.4 GHz** | Portée plus grande, plus de congestion |
| 5150–5875 MHz | **5 GHz** | Débit plus élevé, portée réduite |
| > 5925 MHz | **6 GHz** (Wi-Fi 6E) | Très rapide, portée courte |

---

## Référence des fichiers

### `modules/WifiScanner/src/NativeWifiScanner.ts`

**Rôle** : Contrat TypeScript entre JS et le natif. Ne jamais appeler directement.

```typescript
export interface Spec extends TurboModule {
  // Retourne un tableau d'objets réseau (voir structure ci-dessus)
  scanWifi(): Promise<Object[]>;

  // ssid : nom du réseau cible
  // password : mot de passe WPA (vide string pour réseau ouvert)
  // Retourne : true si connecté, false sinon
  connectToWifi(ssid: string, password: string): Promise<boolean>;
}
```

---

### `modules/WifiScanner/src/index.tsx`

**Rôle** : Couche d'abstraction. Protège contre `null` si le module n'est pas disponible.

```typescript
// Retourne [] si le module est null (ex: simulateur iOS)
export function scanWifi(): Promise<any[]> {
  return WifiScanner?.scanWifi() ?? Promise.resolve([]);
}

// Retourne false si le module est null
export function connectToWifi(ssid: string, password: string): Promise<boolean> {
  return WifiScanner?.connectToWifi(ssid, password) ?? Promise.resolve(false);
}
```

---

### `modules/WifiScanner/android/src/main/java/com/wifiscanner/WifiScannerModule.kt`

**Rôle** : Implémentation Android de toute la logique native.

#### Classe `WifiScannerModule`

Hérite de `NativeWifiScannerSpec` (générée par codegen).

```kotlin
class WifiScannerModule(reactContext: ReactApplicationContext) : NativeWifiScannerSpec(reactContext)
```

#### Méthode `getName() : String`

Retourne le nom du module tel qu'il sera accessible depuis JS via `TurboModuleRegistry`.
```kotlin
override fun getName() = "WifiScanner"
```

#### Méthode `scanWifi(promise: Promise)`

| Aspect | Détail |
|---|---|
| Annotation | `@ReactMethod` |
| Thread | Thread React Native (non-UI) |
| Async | Oui — via BroadcastReceiver |
| Permissions requises | `ACCESS_FINE_LOCATION` |
| API Android min | 23 (pour les permissions) |

#### Méthode `connectToWifi(ssid, password, promise)`

| Aspect | Détail |
|---|---|
| Annotation | `@ReactMethod` |
| API Android min | **Q (API 29 / Android 10)** |
| Méthode | `ConnectivityManager.requestNetwork()` |
| Limitation | La connexion reste active tant que l'app tourne |

---

### `modules/WifiScanner/android/build.gradle`

Config Gradle du module. Contient un hook important :

```groovy
// Patch automatique du CMakeLists.txt généré par codegen
// Nécessaire pour NDK 27 — ajoute c++_shared aux dépendances de link
afterEvaluate {
  tasks.matching { it.name.startsWith("generateCodegenArtifactsFrom") }.configureEach {
    finalizedBy("patchCodegenCMakeLists")
  }
  task patchCodegenCMakeLists { ... }
}
```

---

## Comment ajouter une nouvelle fonction native

Exemple : ajouter `getConnectedSSID()` qui retourne le SSID actuel.

### Étape 1 — Modifier la spec TypeScript

```typescript
// modules/WifiScanner/src/NativeWifiScanner.ts
export interface Spec extends TurboModule {
  scanWifi(): Promise<Object[]>;
  connectToWifi(ssid: string, password: string): Promise<boolean>;
  getConnectedSSID(): Promise<string | null>;  // ← Ajouter ici
}
```

### Étape 2 — Exporter depuis l'API publique

```typescript
// modules/WifiScanner/src/index.tsx
export function getConnectedSSID(): Promise<string | null> {
  return WifiScanner?.getConnectedSSID() ?? Promise.resolve(null);
}
```

### Étape 3 — Implémenter en Kotlin

```kotlin
// WifiScannerModule.kt
@ReactMethod
override fun getConnectedSSID(promise: Promise) {
  try {
    val wifiManager = reactApplicationContext.applicationContext
      .getSystemService(Context.WIFI_SERVICE) as WifiManager
    @Suppress("DEPRECATION")
    val info = wifiManager.connectionInfo
    val ssid = info?.ssid?.replace("\"", "") ?: ""
    promise.resolve(if (ssid.isEmpty() || ssid == "<unknown ssid>") null else ssid)
  } catch (e: Exception) {
    promise.reject("ERROR", e.message)
  }
}
```

### Étape 4 — Rebuilder

```bash
cd android && ./gradlew clean
cd .. && npm run android
```

> Le codegen re-génère automatiquement les fichiers C++/Java à partir de la nouvelle spec.

---

## Build Android — Détails techniques

### Versions configurées

```groovy
// android/build.gradle
ext {
  buildToolsVersion = "36.0.0"
  minSdkVersion    = 24          // Android 7.0 minimum
  compileSdkVersion = 36
  targetSdkVersion  = 36
  ndkVersion        = "27.1.12297006"  // NDK obligatoire
  kotlinVersion     = "2.1.20"
}
```

### Flags importants

```properties
# android/gradle.properties
newArchEnabled=true      # Active TurboModules + Fabric
hermesEnabled=true       # Moteur JS Hermes (performances)
reactNativeArchitectures=arm64-v8a  # Compilation pour appareils 64-bit
```

### Dépendances npm importantes

| Package | Version | Rôle |
|---|---|---|
| `react-native` | 0.85.3 | Framework principal |
| `react-native-safe-area-context` | ^5.5.2 | Gestion des zones sûres (notch, etc.) |
| `@react-native-async-storage/async-storage` | — | Persistance locale (favoris) |
| `@react-native-community/netinfo` | — | Détection réseau actif |
| `patch-package` | — | Maintient les patches des node_modules |

---

## Patches appliqués

### `patch-package` — react-native-safe-area-context

**Fichier patché** : `node_modules/react-native-safe-area-context/android/src/main/jni/CMakeLists.txt`

**Changement** :
```cmake
# Avant
target_link_libraries(
  react_codegen_safeareacontext
  fbjni
  jsi
  reactnative
)

# Après
target_link_libraries(
  react_codegen_safeareacontext
  c++_shared        ← Ajouté pour NDK 27
  fbjni
  jsi
  reactnative
)
```

**Raison** : NDK 27 rend le lien vers `libc++_shared.so` obligatoire explicite. Sans cela, les symboles C++ standard (`std::string`, `operator new`, etc.) sont indéfinis au moment du link.

### Gradle hook — WifiScanner codegen

**Fichier** : `modules/WifiScanner/android/build.gradle`

Le codegen React Native régénère `CMakeLists.txt` à chaque build. Le hook Gradle applique le même patch automatiquement après chaque exécution du codegen, sans avoir à utiliser `patch-package` sur un fichier généré.

---

*Documentation technique — Module WifiScanner — v1.0 — Juin 2026*
