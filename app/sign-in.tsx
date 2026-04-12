/**
 * SIGN-IN SCREEN
 * Email/password + Google OAuth.
 * Redirects to /(tabs) on success.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

type Mode = 'signin' | 'signup';

export default function SignInScreen() {
  const router = useRouter();
  const { user, loading, signInWithEmail, signUp, signInWithGoogle, error, clearError } = useAuth();

  const [mode, setMode]           = useState<Mode>('signin');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [name, setName]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect once authenticated
  useEffect(() => {
    if (!loading && user) router.replace('/(tabs)/planner');
  }, [user, loading]);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setSubmitting(true);
    clearError();
    if (mode === 'signin') {
      await signInWithEmail(email, password);
    } else {
      await signUp(email, password, name || 'Rider');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#39FF14" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        {/* Logo / Title */}
        <View style={styles.logoRow}>
          <Text style={styles.logo}>🚵</Text>
          <View>
            <Text style={styles.appName}>Tuscany Trail</Text>
            <Text style={styles.appSub}>Planner 2026</Text>
          </View>
        </View>

        {/* Toggle */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
            onPress={() => { setMode('signin'); clearError(); }}
          >
            <Text style={[styles.modeTxt, mode === 'signin' && styles.modeTxtActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
            onPress={() => { setMode('signup'); clearError(); }}
          >
            <Text style={[styles.modeTxt, mode === 'signup' && styles.modeTxtActive]}>Create Account</Text>
          </TouchableOpacity>
        </View>

        {/* Display name (sign-up only) */}
        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor="#4B5563"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#4B5563"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#4B5563"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        {/* Error */}
        {error ? <Text style={styles.errorTxt}>{error}</Text> : null}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#0D1B0F" size="small" />
            : <Text style={styles.primaryBtnTxt}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
          }
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerTxt}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google */}
        <TouchableOpacity style={styles.googleBtn} onPress={signInWithGoogle} activeOpacity={0.85}>
          <Text style={styles.googleBtnTxt}>🔵  Continue with Google</Text>
        </TouchableOpacity>

        {/* Skip (guest) */}
        <TouchableOpacity onPress={() => router.replace('/(tabs)/planner')} style={styles.skipBtn}>
          <Text style={styles.skipTxt}>Continue as guest  →</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#0D1B0F', justifyContent: 'center', alignItems: 'center' },
  center:        { flex: 1, backgroundColor: '#0D1B0F', justifyContent: 'center', alignItems: 'center' },
  card:          { width: '100%', maxWidth: 400, padding: 28, gap: 12 },

  logoRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  logo:          { fontSize: 40 },
  appName:       { color: '#39FF14', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  appSub:        { color: '#6B7280', fontSize: 13 },

  modeRow:       { flexDirection: 'row', backgroundColor: '#111D13', borderRadius: 8, padding: 3, marginBottom: 4 },
  modeBtn:       { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#1E3322' },
  modeTxt:       { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  modeTxtActive: { color: '#39FF14' },

  input: {
    backgroundColor: '#111D13',
    borderWidth: 1,
    borderColor: '#1E3322',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#E5E7EB',
    fontSize: 15,
  },

  errorTxt:      { color: '#FF6B6B', fontSize: 13, textAlign: 'center' },

  primaryBtn:    { backgroundColor: '#39FF14', borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  primaryBtnTxt: { color: '#0D1B0F', fontSize: 15, fontWeight: '800' },

  dividerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine:   { flex: 1, height: 1, backgroundColor: '#1E3322' },
  dividerTxt:    { color: '#4B5563', fontSize: 13 },

  googleBtn:     { backgroundColor: '#111D13', borderWidth: 1, borderColor: '#1E3322', borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  googleBtnTxt:  { color: '#E5E7EB', fontSize: 15, fontWeight: '600' },

  skipBtn:       { alignItems: 'center', paddingVertical: 8 },
  skipTxt:       { color: '#4B5563', fontSize: 13 },
});
