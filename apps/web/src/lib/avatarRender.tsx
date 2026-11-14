import { setAvatarRenderer } from '@brett-und-blatt/ui';
import { Avatar } from '../components/Avatar';

// Spielerchips und andere Bausteine der gemeinsamen Bibliothek zeigen Avatare mit gemaltem Bild.
setAvatarRenderer((avatar) => <Avatar value={avatar} />);
