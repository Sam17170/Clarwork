import GeneratorForm from './components/GeneratorForm.jsx';

export default function App() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Créez l'aperçu de votre site en 10 secondes</h1>
      <GeneratorForm />
    </div>
  );
}
