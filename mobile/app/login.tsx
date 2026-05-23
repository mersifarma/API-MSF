import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "@/src/config/api";
import { API_BASE_URL, APP_VERSION } from "@/src/config/env";
import { useAuth } from "@/src/store/auth-context";

const PRIMARY = "#004AC6";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const onSubmit = async () => {
    if (!username || !password) {
      Alert.alert("Login", "Isi username & password dulu.");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `${e.message} (${e.code})`
          : e instanceof Error
            ? e.message
            : "Login gagal — periksa koneksi.";
      Alert.alert("Login gagal", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onContactAdmin = () => {
    Alert.alert(
      "Contact Administrator",
      "Hubungi admin Mersi untuk pendaftaran akun baru.",
    );
  };

  const onForgotPassword = () => {
    Alert.alert(
      "Lupa Password",
      "Hubungi administrator untuk reset password akun Anda.",
    );
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "left", "right", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <MaterialIcons name="local-hospital" size={36} color={PRIMARY} />
            </View>
            <Text style={styles.brandText}>Mersi Sales Force</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.greeting}>
              <Text style={styles.greetingTitle}>Welcome Back</Text>
              <Text style={styles.greetingSub}>Log in to MSF</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons
                  name="person"
                  size={20}
                  color="#64748B"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your username"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  value={username}
                  onChangeText={setUsername}
                  editable={!submitting}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  selectionColor={PRIMARY}
                  underlineColorAndroid="transparent"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons
                  name="lock"
                  size={20}
                  color="#64748B"
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  value={password}
                  onChangeText={setPassword}
                  editable={!submitting}
                  returnKeyType="go"
                  onSubmitEditing={onSubmit}
                  selectionColor={PRIMARY}
                  underlineColorAndroid="transparent"
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                >
                  <MaterialIcons
                    name={showPassword ? "visibility-off" : "visibility"}
                    size={20}
                    color="#64748B"
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.optionsRow}>
              <Pressable
                style={styles.rememberWrap}
                onPress={() => setRemember((v) => !v)}
                hitSlop={6}
              >
                <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                  {remember && (
                    <MaterialIcons name="check" size={14} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.rememberText}>Remember Me</Text>
              </Pressable>
              <Pressable onPress={onForgotPassword} hitSlop={6}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </Pressable>
            </View>

            <TouchableOpacity
              style={[styles.submit, submitting && styles.submitDisabled]}
              onPress={onSubmit}
              disabled={submitting}
              activeOpacity={0.9}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.submitText}>Log In</Text>
                  <MaterialIcons
                    name="arrow-forward"
                    size={20}
                    color="#FFFFFF"
                  />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.securityRow}>
              <MaterialIcons name="verified-user" size={14} color="#10B981" />
              <Text style={styles.securityText}>Mersi Sales Force Mobile</Text>
            </View>
          </View>

          <View style={styles.helpRow}>
            <Text style={styles.helpText}>
              Don&apos;t have an account?{" "}
              <Text style={styles.helpLink} onPress={onContactAdmin}>
                Contact Administrator
              </Text>
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerMeta} numberOfLines={1}>
            API · {API_BASE_URL} · v{APP_VERSION}
          </Text>
          <Text style={styles.footerCopy}>
            © 2026 Mersi Sales Force Mobile.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F4F6" },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    justifyContent: "center",
  },

  brand: { alignItems: "center", gap: 12, marginBottom: 24 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: "#EEEFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DBE1FF",
  },
  brandText: {
    fontSize: 24,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: -0.5,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C3C6D7",
    padding: 24,
    gap: 18,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  greeting: { gap: 4 },
  greetingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  greetingSub: { fontSize: 14, color: "#64748B" },

  field: { gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C3C6D7",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    paddingHorizontal: 0,
    margin: 0,
    includeFontPadding: false,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 4,
  },

  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -4,
  },
  rememberWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#C3C6D7",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxOn: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  rememberText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  forgotText: { fontSize: 12, fontWeight: "600", color: PRIMARY },

  submit: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 4,
  },
  securityText: { fontSize: 10, fontWeight: "500", color: "#64748B" },

  helpRow: {
    marginTop: 24,
    alignItems: "center",
  },
  helpText: { fontSize: 14, color: "#64748B" },
  helpLink: { color: PRIMARY, fontWeight: "600" },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#C3C6D7",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
  },
  footerMeta: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
  },
  footerCopy: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
  },
});
