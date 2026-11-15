/**
 * Digital Bridge Accessible Video Player (<db-player>)
 * ALX Digital Bridge Accessibility Hackathon · Track 2: Accessible learning media
 *
 * ES Module entry point. Defines <db-player> and <digital-bridge-player>.
 */
import '../frontend/digital-bridge-player.js';

export default (typeof customElements !== 'undefined') ? customElements.get('db-player') : null;
