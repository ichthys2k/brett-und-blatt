import { setAvatarImageResolver, setAvatarRenderer } from '@brett-und-blatt/ui';
import { Avatar } from '../components/Avatar';
import { avatarUrl } from './avatarArt';

// Spielerchips und andere Bausteine der gemeinsamen Bibliothek zeigen Avatare mit gemaltem Bild.
setAvatarRenderer((avatar) => <Avatar value={avatar} />);
// Großansicht des Spielerchips (#422): dasselbe gemalte Bild.
setAvatarImageResolver(avatarUrl);
