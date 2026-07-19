// Cloud persistence adapter — Firebase Firestore, free Spark tier.
//
// Dormant until VITE_FIREBASE_CONFIG is set (a JSON one-liner from the
// Firebase console). With no config, initCloud() resolves to { enabled:false }
// and the homestead system runs device-local + Ably live-share only. With
// config, the Firebase SDK is dynamically imported (its chunk never loads
// otherwise), the device signs in anonymously (stable per-browser uid), and
// homestead plots become shared and permanent for every player.
//
// Firestore layout:  plots/{plotId} → { owner, name, updated, pieces[] }
// Security rules (pasted in the console) enforce owner-only writes.

export async function initCloud() {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG;
  if (!raw) return { enabled: false };

  let config;
  try { config = JSON.parse(raw); }
  catch { console.warn('Cloud disabled — VITE_FIREBASE_CONFIG is not valid JSON'); return { enabled: false }; }

  try {
    const [{ initializeApp }, fs, { getAuth, signInAnonymously }] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
      import('firebase/auth'),
    ]);
    const app  = initializeApp(config);
    const db   = fs.getFirestore(app);
    const auth = getAuth(app);
    const cred = await signInAnonymously(auth);
    const uid  = cred.user.uid;

    // Live view of every plot — fires once with current state, then on changes
    function watchPlots(cb) {
      return fs.onSnapshot(fs.collection(db, 'plots'), snap => {
        for (const d of snap.docChanges()) {
          cb(d.doc.id, d.type === 'removed' ? null : d.doc.data());
        }
      }, err => console.warn('Cloud plot watch error:', err.message));
    }

    async function savePlot(plotId, data) {
      try {
        await fs.setDoc(fs.doc(db, 'plots', plotId), data);
        return true;
      } catch (e) {
        console.warn('Cloud save failed:', e.message);
        return false;
      }
    }

    async function deletePlot(plotId) {
      try { await fs.deleteDoc(fs.doc(db, 'plots', plotId)); } catch {}
    }

    console.log('Cloud persistence active (Firebase)');
    return { enabled: true, uid, watchPlots, savePlot, deletePlot };
  } catch (e) {
    console.warn('Cloud disabled —', e.message);
    return { enabled: false };
  }
}
