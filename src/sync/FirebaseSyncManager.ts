import { signInAnonymously, type Auth, type User } from 'firebase/auth'
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'

interface SyncDeps {
  auth: Auth
  firestore: Firestore
  sharedSyncDocId: string
}

const INSTALLATION_ID_KEY = 'rhythm_firebase_sync.installation_id'

const COLLECTION_SHARED_SYNC = 'shared_sync'

const FIELD_STATE_JSON = 'stateJson'
const FIELD_UPDATED_AT_EPOCH_MS = 'updatedAtEpochMs'
const FIELD_SOURCE_ID = 'sourceId'

function getInstallationId() {
  const existing = localStorage.getItem(INSTALLATION_ID_KEY)
  if (existing) return existing

  const generated = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  localStorage.setItem(INSTALLATION_ID_KEY, generated)
  return generated
}

function javaStringHash(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return hash
}

export class FirebaseSyncManager {
  private readonly auth: Auth
  private readonly firestore: Firestore
  private readonly installationId: string
  private readonly sharedSyncDocId: string

  private listenerUnsubscribe: Unsubscribe | null = null
  private uploadTimer: ReturnType<typeof setTimeout> | null = null
  private latestPendingStateJson: string | null = null
  private lastAppliedRemoteHash: number | null = null

  constructor({ auth, firestore, sharedSyncDocId }: SyncDeps) {
    this.auth = auth
    this.firestore = firestore
    this.installationId = getInstallationId()
    this.sharedSyncDocId = sharedSyncDocId
  }

  async start(onRemoteState: (stateJson: string) => void) {
    const user = await this.getOrCreateUser()
    if (!user) return

    const stateDoc = doc(this.firestore, COLLECTION_SHARED_SYNC, this.sharedSyncDocId)
    let remoteHasStateAtStartup = false

    // Read the current shared doc before flushing any queued local state.
    // This prevents a fresh/empty tab from overwriting existing shared data.
    try {
      const startupSnapshot = await getDoc(stateDoc)
      const startupStateJson = startupSnapshot.get(FIELD_STATE_JSON)
      if (typeof startupStateJson === 'string' && startupStateJson.length > 0) {
        remoteHasStateAtStartup = true
        const startupHash = javaStringHash(startupStateJson)
        this.lastAppliedRemoteHash = startupHash
        onRemoteState(startupStateJson)
      }
    } catch {
      // Ignore startup read errors; live listener below remains the source of truth.
    }

    this.listenerUnsubscribe?.()
    this.listenerUnsubscribe = onSnapshot(stateDoc, (snapshot) => {
      const stateJson = snapshot.get(FIELD_STATE_JSON)
      if (typeof stateJson !== 'string' || stateJson.length === 0) return

      const sourceId = snapshot.get(FIELD_SOURCE_ID)
      if (sourceId === this.installationId) return

      const hash = javaStringHash(stateJson)
      if (this.lastAppliedRemoteHash === hash) return

      this.lastAppliedRemoteHash = hash
      onRemoteState(stateJson)
    })

    if (this.latestPendingStateJson && !remoteHasStateAtStartup) {
      await this.writeState(this.latestPendingStateJson)
      this.latestPendingStateJson = null
    } else if (remoteHasStateAtStartup) {
      this.latestPendingStateJson = null
    }
  }

  scheduleUpload(stateJson: string) {
    this.latestPendingStateJson = stateJson

    if (this.uploadTimer) {
      clearTimeout(this.uploadTimer)
    }

    this.uploadTimer = setTimeout(async () => {
      if (!this.auth.currentUser || !this.latestPendingStateJson) return

      await this.writeState(this.latestPendingStateJson)
      this.latestPendingStateJson = null
    }, 500)
  }

  stop() {
    if (this.uploadTimer) {
      clearTimeout(this.uploadTimer)
      this.uploadTimer = null
    }

    this.listenerUnsubscribe?.()
    this.listenerUnsubscribe = null
  }

  private async getOrCreateUser(): Promise<User | null> {
    if (this.auth.currentUser) return this.auth.currentUser

    try {
      const result = await signInAnonymously(this.auth)
      return result.user
    } catch {
      return null
    }
  }

  private async writeState(stateJson: string) {
    const stateDoc = doc(this.firestore, COLLECTION_SHARED_SYNC, this.sharedSyncDocId)

    await setDoc(
      stateDoc,
      {
        [FIELD_STATE_JSON]: stateJson,
        [FIELD_UPDATED_AT_EPOCH_MS]: Date.now(),
        [FIELD_SOURCE_ID]: this.installationId,
      },
      { merge: true },
    )
  }
}
