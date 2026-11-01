/**
 * Carregador — busca o pacote de dados e entrega para a árvore de componentes.
 *
 * Trata os três estados que importam: carregando, erro e pronto. O erro
 * mostra a mensagem real e o comando que regenera o arquivo, porque o
 * problema mais provável é o pipeline não ter rodado ainda.
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { carregaDados } from '../lib/dados';
import type { Dados } from '../tipos';

interface Estado {
  estado: 'carregando' | 'erro' | 'pronto';
  dados?: Dados;
  erro?: string;
}

export function Carregador({ children }: { children: (d: Dados) => ReactNode }) {
  const [s, setS] = useState<Estado>({ estado: 'carregando' });

  useEffect(() => {
    let ativo = true;
    carregaDados()
      .then((dados) => {
        if (ativo) setS({ estado: 'pronto', dados });
      })
      .catch((e: unknown) => {
        if (ativo) {
          setS({ estado: 'erro', erro: e instanceof Error ? e.message : String(e) });
        }
      });
    return () => {
      ativo = false;
    };
  }, []);

  if (s.estado === 'carregando') {
    return (
      <div className="grid min-h-screen place-items-center bg-tela px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-borda border-t-acento" />
          <p className="text-sm text-texto-2">Carregando os dados do município…</p>
        </div>
      </div>
    );
  }

  if (s.estado === 'erro') {
    return (
      <div className="grid min-h-screen place-items-center bg-tela px-6">
        <div className="cartao-pad max-w-lg">
          <h1 className="font-serif text-xl font-semibold">Não foi possível carregar os dados</h1>
          <p className="mt-2 text-sm text-texto-2">{s.erro}</p>
          <p className="mt-4 text-sm text-texto-2">
            Gere o pacote rodando o pipeline:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-controle bg-superficie-2 p-3 font-mono text-xs">
            cd pipeline{'\n'}
            python coleta_siconfi.py{'\n'}
            python coleta_bg.py{'\n'}
            python processa.py
          </pre>
        </div>
      </div>
    );
  }

  return <>{children(s.dados!)}</>;
}
