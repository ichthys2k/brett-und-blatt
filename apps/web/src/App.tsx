import { UpdateBanner } from './components/UpdateBanner';
import { useRoute } from './lib/router';
import { DisplayScreen } from './screens/Display';
import { Home } from './screens/Home';
import { Menu } from './screens/Menu';
import { Datenschutz, Impressum } from './screens/Legal';
import { Online } from './screens/Online';
import { AccountScreen } from './screens/Account';
import { PassScreen } from './screens/Pass';
import { PassView } from './screens/PassView';
import { Play } from './screens/Play';
import { RoomScreen } from './screens/Room';
import { ClassPage, Classes } from './screens/Classes';
import { LearnHome, LearnScreen } from './screens/Learn';
import { Library } from './screens/Library';
import { CollectionScreen } from './screens/Collection';
import { Operator } from './screens/Operator';
import { PackView } from './screens/PackView';
import { Tournaments } from './screens/Tournaments';
import { SeriesScreen } from './screens/Series';
import { TournamentEmbedScreen, TournamentScreen } from './screens/Tournament';
import { Setup } from './screens/Setup';
import { SoundSettingsScreen } from './screens/SoundSettings';

export function App() {
  return (
    <>
      <Screen />
      <UpdateBanner />
    </>
  );
}

function Screen() {
  const route = useRoute();
  switch (route.name) {
    case 'setup':
      return <Setup key={`${route.gameId}-${JSON.stringify(route.params ?? {})}`} gameId={route.gameId} params={route.params} />;
    case 'play':
      return <Play />;
    case 'online':
      return <Online />;
    case 'tournaments':
      return <Tournaments />;
    case 'packView':
      return <PackView passKey={route.key} />;
    case 'operator':
      return <Operator />;
    case 'library':
      return <Library />;
    case 'learn':
      return <LearnHome />;
    case 'learning':
      return <LearnScreen key={route.source} source={route.source} />;
    case 'collection':
      return <CollectionScreen key={route.source} source={route.source} />;
    case 'classes':
      return <Classes />;
    case 'class':
      return <ClassPage key={route.code} code={route.code} />;
    case 'room':
      return <RoomScreen key={route.code} code={route.code} />;
    case 'display':
      return <DisplayScreen key={route.code} code={route.code} />;
    case 'tournament':
      return <TournamentScreen key={route.code} code={route.code} claim={route.claim} helper={route.helper} leader={route.leader} />;
    case 'tournamentEmbed':
      return <TournamentEmbedScreen key={route.code} code={route.code} />;
    case 'series':
      return <SeriesScreen key={route.code} code={route.code} leader={route.leader} />;
    case 'seriesEmbed':
      return <SeriesScreen key={route.code} code={route.code} embed />;
    case 'sound':
      return <SoundSettingsScreen />;
    case 'pass':
      return <PassScreen />;
    case 'account':
      return <AccountScreen ticket={route.ticket} error={route.error} reason={route.reason} />;
    case 'passView':
      return <PassView passKey={route.key} />;
    case 'imprint':
      return <Impressum />;
    case 'privacy':
      return <Datenschutz />;
    case 'home':
      return <Home initialFilter={route.filter} initialPlayers={route.players} />;
    default:
      return <Menu />;
  }
}
