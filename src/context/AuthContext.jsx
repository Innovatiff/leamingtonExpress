import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as backend from "@backend";
import { cleanStr } from "@/lib/text";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);

  useEffect(
    () =>
      backend.onAuth((u) =>
        setUser(u ? { uid: u.uid, email: u.email || "", displayName: u.displayName || "" } : null),
      ),
    [],
  );

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return undefined;
    }
    return backend.subscribeProfile(uid, setProfile, () => setProfile(null));
  }, [uid]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading: user === undefined,
      info: profileInfo(profile, user),
      signIn: backend.signIn,
      signUp: backend.signUp,
      signInWithGoogle: backend.signInWithGoogle,
      signOut: backend.signOutUser,
      sendReset: backend.sendReset,
      saveProfile: (patch) => backend.saveProfile(uid, patch),
    }),
    [user, profile, uid],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Read the users/{uid} document (old + new shapes) into flat fields. */
export function profileInfo(profile, user) {
  const ui = profile?.userInformation || {};
  const ad = profile?.address || {};
  const [fallbackFirst = "", ...rest] = cleanStr(profile?.name || user?.displayName).split(/\s+/);
  const firstName = cleanStr(ui.firstName || profile?.firstName || fallbackFirst);
  const lastName = cleanStr(ui.lastName || profile?.lastName || rest.join(" "));
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: cleanStr(user?.email || ui.email || profile?.email),
    phone: cleanStr(ui.phoneNumber || profile?.phoneNumber),
    points: Math.max(0, Number(profile?.expressPoints) || 0),
    address: {
      street: cleanStr(ad.homeAddress || profile?.homeAddress),
      unit: cleanStr(ad.unit),
      town: cleanStr(ad.city || ad.cityProvince || profile?.city),
      postalCode: cleanStr(ad.postalCode || profile?.postalCode),
    },
  };
}
