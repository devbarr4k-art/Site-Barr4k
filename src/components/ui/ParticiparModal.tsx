"use client";

import { X, Gift, Upload, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ParticiparModalProps {
  isOpen: boolean;
  onClose: () => void;
  sorteioId: string;
  sorteioTitle: string;
  isLoggedIn: boolean; // Simulating auth state
}

export default function ParticiparModal({ isOpen, onClose, sorteioId, sorteioTitle, isLoggedIn }: ParticiparModalProps) {
  const router = useRouter();
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [twitchId, setTwitchId] = useState("");
  const [coins, setCoins] = useState("");
  const [instagram, setInstagram] = useState("");

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Sanitizar nome do arquivo: remove caracteres especiais e acentos
      const extension = file.name.split('.').pop();
      let safeName = file.name.substring(0, file.name.lastIndexOf('.'));
      safeName = safeName.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos
      safeName = safeName.replace(/[^a-zA-Z0-9]/g, "_"); // Troca tudo que não é letra/numero por underline
      
      const newSafeName = `${safeName}.${extension}`;
      
      // Cria um novo arquivo com o nome sanitizado
      const sanitizedFile = new File([file], newSafeName, { type: file.type });
      setSelectedFile(sanitizedFile);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      alert("Redirecionando para o Login da Twitch...");
      return;
    }
    
    let proofUrl = null;
    if (selectedFile) {
      proofUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(selectedFile);
      });
    }

    const { error } = await supabase.from('participants').insert([{
      giveaway_id: sorteioId,
      twitch_username: twitchId,
      coins_used: parseInt(coins),
      instagram: instagram,
      proof_url: proofUrl, 
      status: 'pending'
    }]);

    if (!error) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
        router.push("/meus-tickets"); // Redirect to tickets after success
      }, 2500);
    } else {
      alert("Erro ao participar: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121214] border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800/50">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black italic text-white uppercase tracking-wider">
              <Gift className="w-5 h-5 text-purple-500" /> Confirmar Entrada
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Você está participando do sorteio: <strong className="text-white">{sorteioTitle}</strong>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        {!isSuccess ? (
          <form onSubmit={handleConfirm} className="p-6 space-y-5">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">ID DA TWITCH</label>
                <input 
                  type="text" 
                  placeholder="Seu ID ou @"
                  value={twitchId}
                  onChange={(e) => setTwitchId(e.target.value)}
                  required
                  className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-purple-500 uppercase tracking-wider">COINS (QUANTIDADE)</label>
                <input 
                  type="number"
                  min="0"
                  placeholder="Ex: 500"
                  value={coins}
                  onChange={(e) => setCoins(e.target.value)}
                  required
                  className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">INSTAGRAM (PARA CONTATO)</label>
              <input 
                type="text" 
                placeholder="@seu.usuario"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                required
                className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">COMPROVANTE DE ENVIO</label>
              <label className="border-2 border-dashed border-gray-700 hover:border-purple-500 bg-[#0a0a0b] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors group relative">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  required
                />
                <Upload className="w-8 h-8 text-gray-500 group-hover:text-purple-400 transition-colors mb-2" />
                <span className="text-sm text-gray-500 group-hover:text-gray-300 transition-colors text-center">
                  {selectedFile ? (
                    <span className="text-purple-400 font-bold">{selectedFile.name}</span>
                  ) : (
                    "Clique para enviar print"
                  )}
                </span>
              </label>
            </div>

            <button 
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold italic tracking-widest uppercase py-4 rounded-lg mt-4 transition-colors shadow-[0_0_15px_rgba(147,51,234,0.3)]"
            >
              Confirmar Participação
            </button>
          </form>
        ) : (
          /* Success State */
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-2 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase italic">Inscrição Confirmada!</h3>
            <p className="text-gray-400">
              Seus tickets foram gerados. Redirecionando para o seu painel...
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
