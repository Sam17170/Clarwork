import { useState } from 'react';

const PALETTES = [
  { nom: 'Nature & lac', hex: '#16423C, #E8A33D, #EDE4D3, #8FA8A6' },
  { nom: 'Chaleureux artisanal', hex: '#3E2724, #C9932F, #F6EEDD, #A63D2F' },
  { nom: 'Moderne épuré', hex: '#14171A, #FF5A36, #16A394, #F7F5F0' },
  { nom: 'Festif & coloré', hex: '#0E4F4C, #F0577A, #4FD1C5, #FBF7EC' },
];

const TONS = ['Familial', 'Chic & haut de gamme', 'Rustique & authentique', 'Moderne & dynamique'];

export default function GeneratorForm() {
  const [step, setStep] = useState('form');
  const [resultHtml, setResultHtml] = useState('');
  const [leadId, setLeadId] = useState(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    nomEntreprise: '',
    secteur: '',
    ville: '',
    paletteNom: PALETTES[0].nom,
    paletteHex: PALETTES[0].hex,
    ton: TONS[0],
    particularite: '',
    formule: 'essentiel',
  });

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStep('loading');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, photosUrls: [] }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'La génération a échoué, réessayez.');
      }

      const data = await res.json();
      setResultHtml(data.html);
      setLeadId(data.leadId);
      setStep('result');
    } catch (err) {
      setError(err.message);
      setStep('form');
    }
  }

  if (step === 'loading') {
    return (
      <div style={styles.center}>
        <p>Génération de votre aperçu en cours...</p>
      </div>
    );
  }

  if (step === 'result' || step === 'contact') {
    return (
      <div>
        <iframe
          title="Aperçu généré"
          srcDoc={resultHtml}
          style={styles.previewFrame}
        />
        {step === 'result' && (
          <div style={styles.ctaBlock}>
            <p>Recevez votre aperçu complet par email :</p>
            <button style={styles.button} onClick={() => setStep('contact')}>
              Recevoir mon site
            </button>
          </div>
        )}
        {step === 'contact' && <ContactCapture leadId={leadId} />}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <label style={styles.label}>Nom de l'entreprise</label>
      <input
        style={styles.input}
        required
        value={formData.nomEntreprise}
        onChange={(e) => updateField('nomEntreprise', e.target.value)}
      />

      <label style={styles.label}>Secteur d'activité</label>
      <input
        style={styles.input}
        required
        placeholder="ex : boulangerie, plombier, paysagiste..."
        value={formData.secteur}
        onChange={(e) => updateField('secteur', e.target.value)}
      />

      <label style={styles.label}>Ville</label>
      <input
        style={styles.input}
        required
        value={formData.ville}
        onChange={(e) => updateField('ville', e.target.value)}
      />

      <label style={styles.label}>Palette de couleurs</label>
      <div style={styles.paletteRow}>
        {PALETTES.map((p) => (
          <button
            type="button"
            key={p.nom}
            onClick={() => {
              updateField('paletteNom', p.nom);
              updateField('paletteHex', p.hex);
            }}
            style={{
              ...styles.paletteSwatch,
              border: formData.paletteNom === p.nom ? '2px solid #14171A' : '1px solid #ddd',
            }}
          >
            {p.nom}
          </button>
        ))}
      </div>

      <label style={styles.label}>Ton de votre marque</label>
      <div style={styles.paletteRow}>
        {TONS.map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => updateField('ton', t)}
            style={{
              ...styles.paletteSwatch,
              border: formData.ton === t ? '2px solid #14171A' : '1px solid #ddd',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <label style={styles.label}>Ce qui rend votre entreprise unique (optionnel)</label>
      <textarea
        style={styles.textarea}
        rows={2}
        placeholder="ex : face au lac, recette familiale depuis 1980..."
        value={formData.particularite}
        onChange={(e) => updateField('particularite', e.target.value)}
      />

      <label style={styles.label}>Formule</label>
      <div style={styles.paletteRow}>
        <button
          type="button"
          onClick={() => updateField('formule', 'essentiel')}
          style={{
            ...styles.paletteSwatch,
            border: formData.formule === 'essentiel' ? '2px solid #14171A' : '1px solid #ddd',
          }}
        >
          Essentiel
        </button>
        <button
          type="button"
          onClick={() => updateField('formule', 'signature')}
          style={{
            ...styles.paletteSwatch,
            border: formData.formule === 'signature' ? '2px solid #14171A' : '1px solid #ddd',
          }}
        >
          Signature
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button type="submit" style={styles.button}>
        Générer mon aperçu
      </button>
    </form>
  );
}

function ContactCapture({ leadId }) {
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, email, telephone }),
    });
    setSent(true);
  }

  if (sent) {
    return <p style={styles.ctaBlock}>Merci ! Vous recevrez votre aperçu par email très vite.</p>;
  }

  return (
    <form onSubmit={handleSend} style={styles.form}>
      <label style={styles.label}>Email</label>
      <input
        style={styles.input}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label style={styles.label}>Téléphone</label>
      <input
        style={styles.input}
        type="tel"
        required
        value={telephone}
        onChange={(e) => setTelephone(e.target.value)}
      />
      <button type="submit" style={styles.button}>Recevoir mon site</button>
    </form>
  );
}

const styles = {
  form: { display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 480 },
  label: { fontSize: 13, fontWeight: 600, marginTop: 10 },
  input: { padding: 10, border: '1px solid #ddd', borderRadius: 4, fontSize: 14 },
  textarea: { padding: 10, border: '1px solid #ddd', borderRadius: 4, fontSize: 14 },
  paletteRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  paletteSwatch: { padding: '8px 14px', borderRadius: 20, background: '#fff', cursor: 'pointer', fontSize: 13 },
  button: { marginTop: 16, padding: '14px 24px', background: '#FF5A36', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' },
  center: { textAlign: 'center', padding: 60 },
  previewFrame: { width: '100%', height: '80vh', border: '1px solid #ddd', borderRadius: 8 },
  ctaBlock: { textAlign: 'center', marginTop: 20 },
};
