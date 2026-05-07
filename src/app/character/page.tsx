import Navbar from "@/components/Navbar";
import { CHARACTER_DNA } from "@/lib/character";
import { Cpu, Palette, Shirt, User } from "lucide-react";

export default function CharacterPage() {
  const { physical_attributes, outfit, art_style, name } = CHARACTER_DNA;

  return (
    <main className="min-h-screen bg-[var(--bg-main)] pb-24">
      <Navbar />
      
      <header className="max-w-7xl mx-auto px-6 pt-20 pb-16 border-b border-[var(--border-soft)]">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white">
            <Cpu size={24} />
          </div>
          <h1 className="text-5xl md:text-7xl typography-title uppercase tracking-tighter">{name}</h1>
        </div>
        <p className="text-xl text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          The digital soul of Pager. This is the DNA protocol used by our AI to generate consistent brand assets and character illustrations.
        </p>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        
        {/* Physical Attributes */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
            <User size={14} /> <span>Physical DNA</span>
          </div>
          <div className="space-y-4">
            {Object.entries(physical_attributes).map(([key, value]) => (
              <div key={key} className="border-l-2 border-black pl-4">
                <span className="block text-[10px] uppercase font-bold text-gray-400">{key.replace('_', ' ')}</span>
                <span className="text-lg font-medium">{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Outfit & Gear */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
            <Shirt size={14} /> <span>Outfit & Gear</span>
          </div>
          <div className="space-y-4">
            {Object.entries(outfit).map(([key, value]) => (
              <div key={key} className="border-l-2 border-black pl-4">
                <span className="block text-[10px] uppercase font-bold text-gray-400">{key}</span>
                <span className="text-lg font-medium">{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Art Style */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
            <Palette size={14} /> <span>Art Protocol</span>
          </div>
          <div className="space-y-4">
            <div className="border-l-2 border-black pl-4">
              <span className="block text-[10px] uppercase font-bold text-gray-400">Base Style</span>
              <span className="text-lg font-medium">{art_style.base}</span>
            </div>
            <div className="border-l-2 border-black pl-4">
              <span className="block text-[10px] uppercase font-bold text-gray-400">Lighting</span>
              <span className="text-lg font-medium">{art_style.lighting}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {art_style.keywords.map(kw => (
                <span key={kw} className="px-2 py-1 bg-gray-100 text-[10px] font-bold uppercase rounded-sm border border-[var(--border-soft)]">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </section>

      </div>

      <section className="max-w-7xl mx-auto px-6 mt-12">
        <div className="bg-black text-white p-8 md:p-12 rounded-sm">
          <h2 className="text-2xl font-bold mb-4 uppercase tracking-tighter">AI Integration</h2>
          <p className="text-gray-400 mb-8 max-w-xl">
            This data is used as a System Prompt for our generative models. It ensures that Cyber-Ghoul remains consistent across all story banners.
          </p>
          <code className="block bg-white/10 p-4 text-xs font-mono text-gray-200 overflow-x-auto">
            {`"Illustration featuring Cyber-Ghoul: ${physical_attributes.species} with ${physical_attributes.skin_color} skin..."`}
          </code>
        </div>
      </section>
    </main>
  );
}
