import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Barcode,
  Camera,
  Check,
  Dog,
  Download,
  Edit3,
  LogOut,
  PackagePlus,
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  Users,
  X
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import "./styles.css";

const defaultTypes = ["Tablet", "Syrup", "Powder", "Injection", "Ointment", "Drops", "Spray"];
const defaultSubclasses = [
  "antibiotics",
  "supplements",
  "pain relief",
  "deworming",
  "skin",
  "antacid",
  "sprays/ointments",
  "powders",
  "eye/ear"
];

const seedDogs = [
  { id: "dog-bruno", name: "Bruno", kennel: "A-12" },
  { id: "dog-luna", name: "Luna", kennel: "B-04" },
  { id: "dog-moti", name: "Moti", kennel: "Recovery" }
];

const seedUsers = [
  { id: "admin-local", name: "Inventory Admin", email: env("VITE_ADMIN_USER_ID", "aroragagan09@gmail.com"), userId: env("VITE_ADMIN_USER_ID", "aroragagan09@gmail.com"), role: "admin" },
  { id: "vet-1", name: "Clinic Staff", email: "staff@example.com", userId: "staff@example.com", role: "user" }
];

function env(key, fallback = "") {
  return import.meta.env[key] || fallback;
}

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function qrUrl(serialNumber, size = 260) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(serialNumber)}`;
}

const firebaseConfig = {
  apiKey: env("VITE_FIREBASE_API_KEY"),
  authDomain: env("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: env("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: env("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: env("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: env("VITE_FIREBASE_APP_ID")
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);
const firebaseApp = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;

function useInventoryStore() {
  const [state, setState] = useState(() => {
    const stored = localStorage.getItem("pfa-inventory");
    if (stored) return JSON.parse(stored);
    return {
      medicines: [],
      dogs: seedDogs,
      users: seedUsers,
      types: defaultTypes,
      subclasses: defaultSubclasses
    };
  });

  useEffect(() => {
    localStorage.setItem("pfa-inventory", JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!db) return undefined;
    const unsubscribers = [
      onSnapshot(collection(db, "medicines"), (snapshot) => {
        setState((current) => ({ ...current, medicines: snapshot.docs.map((item) => item.data()) }));
      }),
      onSnapshot(collection(db, "dogs"), (snapshot) => {
        const dogs = snapshot.docs.map((item) => item.data());
        if (dogs.length) setState((current) => ({ ...current, dogs }));
      }),
      onSnapshot(collection(db, "users"), (snapshot) => {
        const users = snapshot.docs.map((item) => item.data());
        if (users.length) setState((current) => ({ ...current, users }));
      }),
      onSnapshot(collection(db, "settings"), (snapshot) => {
        const settings = Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data().values || []]));
        setState((current) => ({ ...current, ...settings }));
      })
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const api = useMemo(
    () => ({
      async addMedicine(payload) {
        const provisionalId = id("med");
        const medicine = {
          ...payload,
          id: provisionalId,
          serialNumber: provisionalId,
          quantity: Number(payload.quantity || 0),
          status: "Available",
          holdDogId: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        if (db) {
          const docRef = await addDoc(collection(db, "medicines"), medicine);
          const firestoreMedicine = { ...medicine, id: docRef.id, serialNumber: docRef.id };
          await setDoc(docRef, firestoreMedicine);
          return firestoreMedicine;
        }
        setState((current) => ({ ...current, medicines: [medicine, ...current.medicines] }));
        return medicine;
      },
      async updateMedicine(serialNumber, patch) {
        if (db) {
          const updatePayload = {
            ...patch,
            ...(patch.quantity === undefined ? {} : { quantity: Number(patch.quantity) }),
            updatedAt: new Date().toISOString()
          };
          await updateDoc(doc(db, "medicines", serialNumber), updatePayload);
          return;
        }
        setState((current) => ({
          ...current,
          medicines: current.medicines.map((medicine) =>
            medicine.serialNumber === serialNumber
              ? { ...medicine, ...patch, quantity: Number(patch.quantity ?? medicine.quantity), updatedAt: new Date().toISOString() }
              : medicine
          )
        }));
      },
      async deleteMedicine(serialNumber) {
        if (db) {
          await deleteDoc(doc(db, "medicines", serialNumber));
          return;
        }
        setState((current) => ({
          ...current,
          medicines: current.medicines.filter((medicine) => medicine.serialNumber !== serialNumber)
        }));
      },
      addListItem(list, value) {
        const clean = value.trim();
        if (!clean) return;
        if (db) {
          const next = Array.from(new Set([...state[list], clean]));
          setDoc(doc(db, "settings", list), { values: next });
          return;
        }
        setState((current) => ({ ...current, [list]: Array.from(new Set([...current[list], clean])) }));
      },
      removeListItem(list, value) {
        if (db) {
          setDoc(doc(db, "settings", list), { values: state[list].filter((item) => item !== value) });
          return;
        }
        setState((current) => ({ ...current, [list]: current[list].filter((item) => item !== value) }));
      },
      addDog(dog) {
        const nextDog = { ...dog, id: id("dog") };
        if (db) {
          setDoc(doc(db, "dogs", nextDog.id), nextDog);
          return;
        }
        setState((current) => ({ ...current, dogs: [...current.dogs, nextDog] }));
      },
      updateDog(dogId, patch) {
        if (db) {
          updateDoc(doc(db, "dogs", dogId), patch);
          return;
        }
        setState((current) => ({
          ...current,
          dogs: current.dogs.map((dog) => (dog.id === dogId ? { ...dog, ...patch } : dog))
        }));
      },
      async removeDog(dogId) {
        if (db) {
          await deleteDoc(doc(db, "dogs", dogId));
          const held = await getDocs(query(collection(db, "medicines"), where("holdDogId", "==", dogId)));
          held.forEach((item) => updateDoc(item.ref, { status: "Available", holdDogId: "" }));
          return;
        }
        setState((current) => ({
          ...current,
          dogs: current.dogs.filter((dog) => dog.id !== dogId),
          medicines: current.medicines.map((medicine) =>
            medicine.holdDogId === dogId ? { ...medicine, status: "Available", holdDogId: "" } : medicine
          )
        }));
      },
      updateUser(userId, patch) {
        if (db) {
          updateDoc(doc(db, "users", userId), patch);
          return;
        }
        setState((current) => ({
          ...current,
          users: current.users.map((user) => (user.id === userId ? { ...user, ...patch } : user))
        }));
      },
      addUser(user) {
        const nextUser = { ...user, id: id("user") };
        if (db) {
          setDoc(doc(db, "users", nextUser.id), nextUser);
          return;
        }
        setState((current) => ({ ...current, users: [...current.users, nextUser] }));
      },
      upsertUser(user) {
        if (db) {
          setDoc(doc(db, "users", user.id), user, { merge: true });
          return;
        }
        setState((current) => {
          const exists = current.users.some((item) => item.id === user.id || item.email === user.email);
          return {
            ...current,
            users: exists
              ? current.users.map((item) => (item.id === user.id || item.email === user.email ? { ...item, ...user } : item))
              : [...current.users, user]
          };
        });
      }
    }),
    [state]
  );

  return [state, api];
}

function App() {
  const [session, setSession] = useState(() => JSON.parse(sessionStorage.getItem("pfa-session") || "null"));
  const [store, actions] = useInventoryStore();
  const [page, setPage] = useState("dashboard");

  const isAdmin = session?.role === "admin";

  async function resolveUserSession(firebaseUser, fallbackName = "") {
    const adminEmail = env("VITE_ADMIN_USER_ID", "aroragagan09@gmail.com").toLowerCase();
    const email = firebaseUser.email.toLowerCase();
    const userRef = doc(db, "users", firebaseUser.uid);
    const profile = await getDoc(userRef);
    const existing = profile.exists() ? profile.data() : {};
    const isConfiguredAdmin = email === adminEmail;
    const next = {
      id: firebaseUser.uid,
      email,
      userId: email,
      name: existing.name || fallbackName || email,
      role: isConfiguredAdmin ? "admin" : existing.role || "user"
    };
    if (!profile.exists() || isConfiguredAdmin) {
      await setDoc(userRef, next, { merge: true });
    }
    sessionStorage.setItem("pfa-session", JSON.stringify(next));
    setSession(next);
    return next;
  }

  function formatAuthError(authError) {
    const code = authError?.code || "";
    if (code === "auth/configuration-not-found") {
      return "Firebase Authentication is not enabled for this project. In Firebase Console, enable Authentication > Sign-in method > Email/Password, then redeploy if you changed env vars.";
    }
    if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
      return "Invalid email or password.";
    }
    if (code === "auth/email-already-in-use") {
      return "An account with this email already exists. Use Login instead.";
    }
    if (code === "auth/weak-password") {
      return "Password should be at least 6 characters.";
    }
    if (code === "permission-denied") {
      return "Login succeeded, but Firestore permissions blocked your user profile. Publish the latest firestore.rules file in Firebase.";
    }
    return authError?.message || "Could not continue. Check your email and password.";
  }

  async function login(email, password) {
    const cleanEmail = email.trim().toLowerCase();
    if (auth && db) {
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      await resolveUserSession(credential.user);
      return true;
    }

    const adminUserId = env("VITE_ADMIN_USER_ID", "aroragagan09@gmail.com").toLowerCase();
    const adminPassword = env("VITE_ADMIN_PASSWORD", "admin123");
    const knownUser = store.users.find((user) => (user.email || user.userId) === cleanEmail);
    if (cleanEmail === adminUserId && password === adminPassword) {
      const next = { id: "admin-local", email: cleanEmail, userId: cleanEmail, role: "admin", name: knownUser?.name || "Admin" };
      sessionStorage.setItem("pfa-session", JSON.stringify(next));
      setSession(next);
      return true;
    }
    if (knownUser && password === "pfa123") {
      const next = { ...knownUser, email: knownUser.email || knownUser.userId };
      sessionStorage.setItem("pfa-session", JSON.stringify(next));
      setSession(next);
      return true;
    }
    throw new Error("Invalid login details");
  }

  async function register(email, password, name) {
    const cleanEmail = email.trim().toLowerCase();
    if (auth && db) {
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await resolveUserSession(credential.user, name);
      return true;
    }

    const adminEmail = env("VITE_ADMIN_USER_ID", "aroragagan09@gmail.com").toLowerCase();
    const next = {
      id: id("user"),
      email: cleanEmail,
      userId: cleanEmail,
      name: name || cleanEmail,
      role: cleanEmail === adminEmail ? "admin" : "user"
    };
    actions.upsertUser(next);
    sessionStorage.setItem("pfa-session", JSON.stringify(next));
    setSession(next);
    return true;
  }

  async function logout() {
    if (auth) await signOut(auth).catch(() => {});
    sessionStorage.removeItem("pfa-session");
    setSession(null);
    setPage("dashboard");
  }

  if (!session) return <LoginPage onLogin={login} onRegister={register} />;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">People for Animals</p>
          <h1>Medicine Inventory</h1>
        </div>
        <button className="iconText ghost" onClick={logout}>
          <LogOut size={18} /> Logout
        </button>
      </header>

      <nav className="tabs">
        <Tab active={page === "dashboard"} onClick={() => setPage("dashboard")} icon={<Barcode size={18} />} label="Dashboard" />
        <Tab active={page === "scan"} onClick={() => setPage("scan")} icon={<Camera size={18} />} label="Scan" />
        <Tab active={page === "dogs"} onClick={() => setPage("dogs")} icon={<Dog size={18} />} label="Dogs" />
        {isAdmin && <Tab active={page === "data"} onClick={() => setPage("data")} icon={<SlidersHorizontal size={18} />} label="Data" />}
        {isAdmin && <Tab active={page === "admin"} onClick={() => setPage("admin")} icon={<Users size={18} />} label="Admin" />}
      </nav>

      <main>
        {page === "dashboard" && <Dashboard store={store} actions={actions} isAdmin={isAdmin} />}
        {page === "scan" && <ScanPage medicines={store.medicines} onUpdate={actions.updateMedicine} />}
        {page === "dogs" && <DogsPage dogs={store.dogs} actions={actions} isAdmin={isAdmin} />}
        {page === "data" && isAdmin && <DataPage store={store} actions={actions} />}
        {page === "admin" && isAdmin && <AdminPage users={store.users} actions={actions} />}
      </main>
    </div>
  );
}

function LoginPage({ onLogin, onRegister }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      if (mode === "register") {
        await onRegister(email, password, name);
      } else {
        await onLogin(email, password);
      }
    } catch (authError) {
      setError(formatAuthError(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="loginShell">
      <section className="loginPanel">
        <img className="loginLogo" src="/logo.svg" alt="People for Animals" />
        <p className="eyebrow">People for Animals</p>
        <h1>{mode === "register" ? "Create Account" : "Inventory Login"}</h1>
        <div className="segmented">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Register</button>
        </div>
        <form onSubmit={submit} className="form">
          {mode === "register" && (
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            </label>
          )}
          <label>
            Email
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label>
            Password
            <input required type="password" minLength="6" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit" disabled={isSubmitting}>
            <Shield size={18} /> {isSubmitting ? "Please wait..." : mode === "register" ? "Register" : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Tab({ active, onClick, icon, label }) {
  return (
    <button className={active ? "tab active" : "tab"} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Dashboard({ store, actions, isAdmin }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [dialog, setDialog] = useState(null);
  const dogById = Object.fromEntries(store.dogs.map((dog) => [dog.id, dog]));

  const rows = store.medicines.filter((medicine) => {
    const haystack = `${medicine.name} ${medicine.type} ${medicine.subclass} ${medicine.dosage}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (type === "All" || medicine.type === type);
  });

  return (
    <section className="pageStack">
      <div className="toolbar">
        <div className="searchBox">
          <Search size={18} />
          <input placeholder="Search medicines" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option>All</option>
          {store.types.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        {isAdmin && (
          <button className="primary" onClick={() => setDialog({ mode: "add" })}>
            <PackagePlus size={18} /> Add Medicine
          </button>
        )}
      </div>

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Quantity</th>
              <th>Expiry</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((medicine) => (
              <tr key={medicine.serialNumber}>
                <td>
                  <strong>{medicine.name}</strong>
                  <small>{medicine.type} · {medicine.subclass} · {medicine.dosage}</small>
                </td>
                <td>{medicine.quantity}</td>
                <td>{medicine.expiryDate}</td>
                <td>
                  <span className={medicine.status === "On Hold" ? "pill hold" : "pill"}>
                    {medicine.status}
                    {medicine.holdDogId ? ` · ${dogById[medicine.holdDogId]?.name || "Dog"}` : ""}
                  </span>
                </td>
                <td className="actions">
                  {isAdmin && (
                    <button title="Edit medicine" onClick={() => setDialog({ mode: "edit", medicine })}>
                      <Edit3 size={16} />
                    </button>
                  )}
                  <button title="Update stock" onClick={() => setDialog({ mode: "stock", medicine })}>
                    <Plus size={16} />
                  </button>
                  <button title="Download barcode" onClick={() => downloadQrSvg(medicine)}>
                    <Download size={16} />
                  </button>
                  {isAdmin && (
                    <button title="Delete medicine" onClick={() => setDialog({ mode: "delete", medicine })}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan="5" className="empty">No medicines found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {dialog?.mode === "add" && (
        <MedicineDialog
          title="Add Medicine"
          types={store.types}
          subclasses={store.subclasses}
          dogs={store.dogs}
          onClose={() => setDialog(null)}
          onSave={(payload) => actions.addMedicine(payload)}
        />
      )}
      {dialog?.mode === "edit" && (
        <MedicineDialog
          title="Edit Medicine"
          medicine={dialog.medicine}
          types={store.types}
          subclasses={store.subclasses}
          dogs={store.dogs}
          onClose={() => setDialog(null)}
          onSave={async (payload) => {
            await actions.updateMedicine(dialog.medicine.serialNumber, payload);
            return { ...dialog.medicine, ...payload };
          }}
        />
      )}
      {dialog?.mode === "stock" && (
        <StockDialog
          medicine={dialog.medicine}
          onClose={() => setDialog(null)}
          onSave={async (quantity) => {
            await actions.updateMedicine(dialog.medicine.serialNumber, { quantity });
            setDialog(null);
          }}
        />
      )}
      {dialog?.mode === "delete" && (
        <ConfirmDialog
          title="Delete Medicine"
          message={`Delete ${dialog.medicine.name} from the database?`}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await actions.deleteMedicine(dialog.medicine.serialNumber);
            setDialog(null);
          }}
        />
      )}
    </section>
  );
}

function MedicineDialog({ title, medicine, types, subclasses, dogs, onClose, onSave }) {
  const [form, setForm] = useState(
    medicine || {
      name: "",
      type: types[0] || "",
      subclass: subclasses[0] || "",
      dosage: "",
      quantity: 0,
      expiryDate: "",
      description: "",
      status: "Available",
      holdDogId: ""
    }
  );
  const [created, setCreated] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function update(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "status" && value !== "On Hold" ? { holdDogId: "" } : {})
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      const saved = await onSave(form);
      if (medicine) {
        onClose();
        return;
      }
      setCreated(saved);
    } catch (saveError) {
      setError(saveError?.message || "Could not save this medicine. Check Firebase settings and Firestore rules.");
    } finally {
      setIsSaving(false);
    }
  }

  if (created && !medicine) {
    return (
      <Dialog onClose={onClose} title="QR Code Generated">
        <QrCard medicine={created} />
        <button className="primary full" onClick={() => downloadQrSvg(created)}>
          <Download size={18} /> Download
        </button>
      </Dialog>
    );
  }

  return (
    <Dialog onClose={onClose} title={title}>
      <form className="form gridForm" onSubmit={submit}>
        <label>Name<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
        <label>Type<select value={form.type} onChange={(event) => update("type", event.target.value)}>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Subclass<select value={form.subclass} onChange={(event) => update("subclass", event.target.value)}>{subclasses.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Dosage<input required placeholder="5mg" value={form.dosage} onChange={(event) => update("dosage", event.target.value)} /></label>
        <label>Quantity<input required type="number" min="0" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} /></label>
        <label>Expiry Date<input required type="date" value={form.expiryDate} onChange={(event) => update("expiryDate", event.target.value)} /></label>
        <label className="wide">Description<textarea value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
        <label>Status<select value={form.status} onChange={(event) => update("status", event.target.value)}><option>Available</option><option>On Hold</option></select></label>
        {form.status === "On Hold" && (
          <label>Dog<select required value={form.holdDogId} onChange={(event) => update("holdDogId", event.target.value)}><option value="">Select dog</option>{dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name} · {dog.kennel}</option>)}</select></label>
        )}
        {error && <p className="error wide">{error}</p>}
        <button className="primary wide" type="submit" disabled={isSaving}>
          <Check size={18} /> {isSaving ? "Saving..." : "Save"}
        </button>
      </form>
    </Dialog>
  );
}

function StockDialog({ medicine, onClose, onSave }) {
  const [quantity, setQuantity] = useState(medicine.quantity);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setIsSaving(true);
    setError("");
    try {
      await onSave(quantity);
    } catch (saveError) {
      setError(saveError?.message || "Could not update this quantity.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog onClose={onClose} title="Update Stock">
      <div className="stockHeader">
        <strong>{medicine.name}</strong>
        <span>{medicine.serialNumber}</span>
      </div>
      <label className="form">
        Quantity
        <input type="number" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary full" onClick={submit} disabled={isSaving}>
        <Check size={18} /> {isSaving ? "Updating..." : "Update Quantity"}
      </button>
    </Dialog>
  );
}

function QrCard({ medicine }) {
  return (
    <div className="qrCard">
      <img src={qrUrl(medicine.serialNumber)} alt={`QR for ${medicine.name}`} />
      <strong>{medicine.name}</strong>
      <span>{medicine.serialNumber}</span>
    </div>
  );
}

function ScanPage({ medicines, onUpdate }) {
  const [scanned, setScanned] = useState("");
  const [medicine, setMedicine] = useState(null);
  const [message, setMessage] = useState("");

  function resolve(serialNumber) {
    const match = medicines.find((item) => item.serialNumber === serialNumber.trim());
    setMedicine(match || null);
    setMessage(match ? "" : "No medicine found for that QR code.");
  }

  return (
    <section className="pageStack">
      <CameraScanner onScan={(value) => { setScanned(value); resolve(value); }} />
      <div className="manualScan">
        <input placeholder="Or enter serial number" value={scanned} onChange={(event) => setScanned(event.target.value)} />
        <button className="primary" onClick={() => resolve(scanned)}>Find</button>
      </div>
      {message && <p className="error">{message}</p>}
      {medicine && (
        <StockDialog
          medicine={medicine}
          onClose={() => setMedicine(null)}
          onSave={async (quantity) => {
            await onUpdate(medicine.serialNumber, { quantity });
            setMedicine(null);
          }}
        />
      )}
    </section>
  );
}

function CameraScanner({ onScan }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [supported, setSupported] = useState("BarcodeDetector" in window);

  useEffect(() => () => stop(), []);

  async function start() {
    if (!("BarcodeDetector" in window)) {
      setSupported(false);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    streamRef.current = stream;
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setRunning(true);
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const tick = async () => {
      if (!streamRef.current) return;
      const codes = await detector.detect(videoRef.current).catch(() => []);
      if (codes[0]?.rawValue) {
        onScan(codes[0].rawValue);
        stop();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRunning(false);
  }

  return (
    <div className="scanner">
      <video ref={videoRef} muted playsInline />
      {!supported && <p>Camera QR scanning needs a browser with BarcodeDetector support. Use the serial field below on this device.</p>}
      <button className={running ? "secondary" : "primary"} onClick={running ? stop : start}>
        <Camera size={18} /> {running ? "Stop Camera" : "Scan to Update"}
      </button>
    </div>
  );
}

function DogsPage({ dogs, actions, isAdmin }) {
  const [name, setName] = useState("");
  const [kennel, setKennel] = useState("");
  return (
    <section className="split">
      <div className="listPanel">
        <h2>Dogs</h2>
        {dogs.map((dog) => (
          <div className="listRow" key={dog.id}>
            <span><strong>{dog.name}</strong><small>{dog.kennel}</small></span>
            {isAdmin && <button onClick={() => actions.removeDog(dog.id)}><Trash2 size={16} /></button>}
          </div>
        ))}
      </div>
      {isAdmin && (
        <form className="form sideForm" onSubmit={(event) => { event.preventDefault(); actions.addDog({ name, kennel }); setName(""); setKennel(""); }}>
          <h2>Add Dog</h2>
          <label>Name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Kennel<input required value={kennel} onChange={(event) => setKennel(event.target.value)} /></label>
          <button className="primary"><Plus size={18} /> Add Dog</button>
        </form>
      )}
    </section>
  );
}

function DataPage({ store, actions }) {
  return (
    <section className="split">
      <EditableList title="Medicine Types" list="types" values={store.types} actions={actions} />
      <EditableList title="Medicine Classes" list="subclasses" values={store.subclasses} actions={actions} />
    </section>
  );
}

function EditableList({ title, list, values, actions }) {
  const [value, setValue] = useState("");
  return (
    <div className="listPanel">
      <h2>{title}</h2>
      <form className="inlineForm" onSubmit={(event) => { event.preventDefault(); actions.addListItem(list, value); setValue(""); }}>
        <input value={value} onChange={(event) => setValue(event.target.value)} />
        <button className="primary"><Plus size={18} /></button>
      </form>
      {values.map((item) => (
        <div className="listRow" key={item}>
          <span>{item}</span>
          <button onClick={() => actions.removeListItem(list, item)}><Trash2 size={16} /></button>
        </div>
      ))}
    </div>
  );
}

function AdminPage({ users, actions }) {
  return (
    <section className="pageStack">
      <div className="listPanel">
        <h2>Users</h2>
        <p className="helperText">Users register from the login screen. Admins can promote or demote registered users here.</p>
        {users.map((user) => (
          <div className="listRow" key={user.id}>
            <span><strong>{user.name}</strong><small>{user.email || user.userId}</small></span>
            <select value={user.role} onChange={(event) => actions.updateUser(user.id, { role: event.target.value })}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}

function Dialog({ title, children, onClose }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <section className="dialog">
        <header>
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function ConfirmDialog({ title, message, onClose, onConfirm }) {
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setIsWorking(true);
    setError("");
    try {
      await onConfirm();
    } catch (confirmError) {
      setError(confirmError?.message || "Could not complete this action.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Dialog title={title} onClose={onClose}>
      <p className="confirmMessage">{message}</p>
      {error && <p className="error">{error}</p>}
      <div className="confirmActions">
        <button type="button" onClick={onClose} disabled={isWorking}>Cancel</button>
        <button type="button" className="danger" onClick={confirm} disabled={isWorking}>
          <Trash2 size={18} /> {isWorking ? "Deleting..." : "Delete"}
        </button>
      </div>
    </Dialog>
  );
}

function downloadQrSvg(medicine) {
  const safeName = medicine.name.replace(/[^\w-]+/g, "-").toLowerCase();
  const qrHref = escapeXml(qrUrl(medicine.serialNumber, 320));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="510" viewBox="0 0 420 510">
    <rect width="420" height="510" fill="#ffffff"/>
    <text x="210" y="48" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#17201b">${escapeXml(medicine.name)}</text>
    <image href="${qrHref}" x="50" y="78" width="320" height="320"/>
    <text x="210" y="440" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#56615b">${escapeXml(medicine.serialNumber)}</text>
    <text x="210" y="470" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#17201b">People for Animals</text>
  </svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${safeName || "medicine"}-qr.svg`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]);
}

createRoot(document.getElementById("root")).render(<App />);
