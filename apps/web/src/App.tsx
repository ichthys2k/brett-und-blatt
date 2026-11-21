import { SnesEgg } from './components/SnesEgg';
import { RewardBanner } from './components/RewardBanner';
import { UpdateBanner } from './components/UpdateBanner';
import { ShellNotice } from './components/ShellNotice';
import { useRoute } from './lib/router';
import {
  ButtonPrompt,
  CardCosmeticsProvider,
  GlobalSpatialNavigator,
  InputProvider,
  ModalFocusManager,
  PromptProvider,
  ScanOverlay,
  SoftCursor,
  VirtualKeyboard,
} from '@brett-und-blatt/ui';
import { useActiveCardCosmetics } from './lib/cardBacks';
import { saveInputSettings, useInputSettings } from './lib/inputSettings';
import { useActiveLook } from './lib/look';
import { useActiveShell } from './lib/shell';
import { consoleScreen } from './console/screens';
import { classicScreen } from './screens/classicScreen';

export function App() {
  const cosmetics = useActiveCardCosmetics(useActiveLook());
  const inputSettings = useInputSettings();
  return (
    <InputProvider settings={inputSettings}>
      <PromptProvider>
      <CardCosmeticsProvider value={cosmetics}>
        <GlobalSpatialNavigator />
        <ModalFocusManager />
        <ScanOverlay />
        <Screen />
        <VirtualKeyboard />
        <SoftCursor />
        <ButtonPrompt onDismiss={() => saveInputSettings({ prompts: false })} />
        <UpdateBanner />
        <ShellNotice />
        <SnesEgg />
        <RewardBanner />
      </CardCosmeticsProvider>
      </PromptProvider>
    </InputProvider>
  );
}

function Screen() {
  const route = useRoute();
  const shell = useActiveShell();
  // Konsolen-Oberfläche (#607): eigener Bildschirm, wo es einen gibt; sonst die klassische Seite.
  if (shell === 'console') {
    const screen = consoleScreen(route);
    if (screen) return screen;
  }
  return classicScreen(route);
}
