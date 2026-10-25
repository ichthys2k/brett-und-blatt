import { useRoute } from './lib/router';
import { Home } from './screens/Home';
import { Play } from './screens/Play';
import { Setup } from './screens/Setup';

export function App() {
  const route = useRoute();
  switch (route.name) {
    case 'setup':
      return <Setup key={route.gameId} gameId={route.gameId} />;
    case 'play':
      return <Play />;
    default:
      return <Home />;
  }
}
