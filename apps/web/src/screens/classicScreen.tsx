import type { ReactElement } from 'react';
import { GalleryClassicNote } from '../console/Gallery';
import type { Route } from '../lib/router';
import { DisplayScreen } from './Display';
import { Home } from './Home';
import { Menu } from './Menu';
import { Datenschutz, Impressum } from './Legal';
import { Online } from './Online';
import { BoardScreen } from './Board';
import { AccountScreen } from './Account';
import { PassScreen } from './Pass';
import { PassView } from './PassView';
import { Play } from './Play';
import { RoomScreen } from './Room';
import { ClassPage, Classes } from './Classes';
import { LearnHome, LearnScreen } from './Learn';
import { Library } from './Library';
import { CollectionScreen } from './Collection';
import { Operator } from './Operator';
import { PackView } from './PackView';
import { Org, Orgs } from './Org';
import { Tournaments } from './Tournaments';
import { SeriesScreen } from './Series';
import { TournamentBeamerScreen, TournamentEmbedScreen, TournamentScreen } from './Tournament';
import { Setup } from './Setup';
import { SoundSettingsScreen } from './SoundSettings';
import { HelpersScreen } from './Helpers';

/** Die klassische Seite einer Route (#638: auch die Konsole zeigt sie im Rahmen, solange es keinen eigenen Bildschirm gibt). */
export function classicScreen(route: Route): ReactElement {
  switch (route.name) {
    case 'setup':
      return <Setup key={`${route.gameId}-${JSON.stringify(route.params ?? {})}`} gameId={route.gameId} params={route.params} />;
    case 'play':
      return <Play />;
    case 'online':
      return <Online />;
    case 'board':
      return <BoardScreen />;
    case 'tournaments':
      return <Tournaments />;
    case 'packView':
      return <PackView passKey={route.key} archive={route.archive === true} />;
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
    case 'orgs':
      return <Orgs />;
    case 'org':
      return <Org key={route.code} code={route.code} invite={route.invite} />;
    case 'class':
      return <ClassPage key={route.code} code={route.code} />;
    case 'room':
      return <RoomScreen key={route.code} code={route.code} />;
    case 'display':
      return <DisplayScreen key={route.code} code={route.code} />;
    case 'tournament':
      return <TournamentScreen key={route.code} code={route.code} claim={route.claim} helper={route.helper} leader={route.leader} />;
    case 'tournamentBeamer':
      return <TournamentBeamerScreen key={route.code} code={route.code} />;
    case 'tournamentEmbed':
      return <TournamentEmbedScreen key={route.code} code={route.code} />;
    case 'series':
      return <SeriesScreen key={route.code} code={route.code} leader={route.leader} />;
    case 'seriesEmbed':
      return <SeriesScreen key={route.code} code={route.code} embed />;
    case 'sound':
      return <SoundSettingsScreen />;
    case 'helpers':
      return <HelpersScreen tool={route.tool} />;
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
    case 'gallery':
      return <GalleryClassicNote />;
    case 'home':
      return <Home initialFilter={route.filter} initialPlayers={route.players} />;
    default:
      return <Menu />;
  }
}

