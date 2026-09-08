import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import 'react-native-reanimated';

import { initDatabase } from '@/services/db-init';

const BheemAITheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#F28C18',
    background: '#0B0B0B',
    card: '#151515',
    text: '#F5F5F5',
    border: '#292929',
    notification: '#F28C18',
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [showPrivacyNotice, setShowPrivacyNotice] =
    useState(false);

  useEffect(() => {
    initDatabase();

    const checkPrivacyNotice = async () => {
      try {
        const acknowledged =
          await SecureStore.getItemAsync(
            'bheemai_privacy_notice_acknowledged'
          );

        if (acknowledged !== 'true') {
          setShowPrivacyNotice(true);
        }
      } catch (error) {
        console.error(
          'Failed to check privacy notice:',
          error
        );
      }
    };

    checkPrivacyNotice();
  }, []);

  const handlePrivacyAcknowledged = async () => {
    try {
      await SecureStore.setItemAsync(
        'bheemai_privacy_notice_acknowledged',
        'true'
      );
    } catch (error) {
      console.error(
        'Failed to save privacy acknowledgement:',
        error
      );
    }

    setShowPrivacyNotice(false);
  };

  return (
    <ThemeProvider value={BheemAITheme}>
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            title: 'Modal',
          }}
        />
      </Stack>

      <StatusBar style="light" />

      <Modal
        visible={showPrivacyNotice}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => {
          // Privacy notice must be acknowledged
          // before continuing into the app.
        }}
      >
        <View style={privacyStyles.overlay}>
          <View style={privacyStyles.card}>

            <ScrollView
              style={privacyStyles.scroll}
              contentContainerStyle={
                privacyStyles.scrollContent
              }
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >

              <Text style={privacyStyles.icon}>
                🔒
              </Text>

              <Text style={privacyStyles.title}>
                Your data. Your device. Your AI.
              </Text>

              <Text style={privacyStyles.subtitle}>
                BheemAI is local-first by design.
              </Text>

              <View style={privacyStyles.item}>
                <Text style={privacyStyles.itemTitle}>
                  🔒 Stored locally
                </Text>

                <Text style={privacyStyles.itemText}>
                  Your profile, measurements and workout
                  history are stored on this device.
                </Text>
              </View>

              <View style={privacyStyles.item}>
                <Text style={privacyStyles.itemTitle}>
                  🗝️ Your Gemini API key
                </Text>

                <Text style={privacyStyles.itemText}>
                  Your Gemini API key is stored securely
                  on this device. BheemAI does not have
                  its own AI account or cloud database.
                </Text>
              </View>

              <View style={privacyStyles.item}>
                <Text style={privacyStyles.itemTitle}>
                  ☁️ Only when you ask Gemini
                </Text>

                <Text style={privacyStyles.itemText}>
                  When you generate a personalized workout,
                  the information needed for that request
                  is sent directly from your device to
                  Google Gemini using your API key.
                </Text>
              </View>

              <View style={privacyStyles.item}>
                <Text style={privacyStyles.itemTitle}>
                  🚫 No BheemAI cloud
                </Text>

                <Text style={privacyStyles.itemText}>
                  BheemAI does not operate a server that
                  collects or stores your fitness history.
                </Text>
              </View>

              <Text style={privacyStyles.note}>
                Google's handling of Gemini API requests
                depends on the Google service, API tier
                and applicable data-use policies.
              </Text>

            </ScrollView>

            <Pressable
              style={privacyStyles.button}
              onPress={handlePrivacyAcknowledged}
            >
              <Text style={privacyStyles.buttonText}>
                I UNDERSTAND
              </Text>
            </Pressable>

          </View>
        </View>
      </Modal>
    </ThemeProvider>
  );
}

const privacyStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },

  card: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '90%',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 24,
    padding: 22,
  },

  scroll: {
    flexShrink: 1,
  },

  scrollContent: {
    paddingBottom: 8,
  },

  icon: {
    fontSize: 32,
    marginBottom: 14,
  },

  title: {
    color: '#F5F5F5',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    marginBottom: 6,
  },

  subtitle: {
    color: '#F28C18',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 20,
  },

  item: {
    marginBottom: 15,
  },

  itemTitle: {
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },

  itemText: {
    color: '#A0A0A0',
    fontSize: 13,
    lineHeight: 19,
  },

  note: {
    color: '#707070',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 4,
  },

  button: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#F28C18',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },

  buttonText: {
    color: '#080808',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});