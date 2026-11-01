/**
 * Auditoria — a confiabilidade dos dados e o que a validação encontrou.
 *
 * Esta seção é a garantia do site: mostra que a soma das subfunções fecha com
 * o total oficial em todos os exercícios, e lista as observações registradas
 * pelo pipeline. Nada é escondido.
 */

import { useMemo } from 'react';

import type { Dados } from '../tipos';
import { CartaoTitulo, Kpi, NotaGrafico, Secao } from '../componentes/blocos';
import { inteiro, porcento, reais } from '../lib/formato';

export function Auditoria({ d }: { d: Dados }) {
  const auditoria = d.execucao.auditoria;

  const confiabilidade = useMemo(
    () =>
      auditoria.map((a) => {
        const ok = a.divergencia !== null && Math.abs(a.divergencia) < 1;
        const registrosOk = a.registros > 0;
        return {
          ...a,
          ok: ok && registrosOk,
          nivel: ok && registrosOk ? 'ALTA' : 'VERIFICAR',
        };
      }),
    [auditoria],
  );

  const totalRegistros = auditoria.reduce((acc, a) => acc + a.registros, 0);
  const todasFecham = confiabilidade.every((c) => c.ok);

  return (
    <Secao
      id="auditoria"
      numero="Seção 8"
      titulo="Auditoria e confiabilidade"
      descricao={
        <>
          Todo número deste site é calculado por código a partir dos dados brutos.
          A âncora de validação é contábil: a soma das subfunções precisa fechar
          com o total declarado no relatório. Se não fechasse, o pipeline pararia.
        </>
      }
    >
      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="Âncora contábil"
          valor={todasFecham ? 'Fechada' : 'Divergente'}
          nota={`${auditoria.length} exercícios verificados`}
          destaque={todasFecham}
        />
        <Kpi
          rotulo="Registros lidos"
          valor={inteiro(totalRegistros)}
          nota="linhas do RREO-Anexo 02"
        />
        <Kpi
          rotulo="Divergência máxima"
          valor={reais(
            Math.max(...auditoria.map((a) => Math.abs(a.divergencia ?? 0))),
            2,
          )}
          nota="soma das subfunções vs. total"
        />
        <Kpi
          rotulo="Observações"
          valor={inteiro(d.problemas.length)}
          nota="registradas pelo pipeline"
        />
      </div>

      <CartaoTitulo
        titulo="Verificação por exercício"
        descricao="Cada ano é validado individualmente antes de entrar no site"
      >
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Exercício</th>
                <th className="num">Registros</th>
                <th className="num">Funções</th>
                <th className="num">Subfunções</th>
                <th className="num">Total liquidado</th>
                <th className="num">Soma subfunções</th>
                <th className="num">Divergência</th>
                <th>Confiabilidade</th>
              </tr>
            </thead>
            <tbody>
              {confiabilidade.map((a) => (
                <tr key={a.ano}>
                  <td className="font-mono font-medium">{a.ano}</td>
                  <td className="num">{inteiro(a.registros)}</td>
                  <td className="num">{a.funcoes}</td>
                  <td className="num">{a.subfuncoes}</td>
                  <td className="num">{reais(a.total_liquidado, 2)}</td>
                  <td className="num">{reais(a.soma_subfuncoes, 2)}</td>
                  <td className="num">
                    <span className={Math.abs(a.divergencia ?? 0) < 1 ? 'text-positivo' : 'text-negativo'}>
                      {reais(a.divergencia, 2)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`etiqueta ${
                        a.ok ? 'etiqueta-positivo' : 'etiqueta-alerta'
                      }`}
                    >
                      {a.nivel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <NotaGrafico>
          A divergência é a diferença entre a soma das subfunções e o total
          declarado no relatório. Zero significa que nada foi perdido na
          decodificação do anexo.
        </NotaGrafico>
      </CartaoTitulo>

      {d.problemas.length > 0 && (
        <CartaoTitulo
          className="mt-5"
          titulo="Observações registradas"
          descricao="O que o pipeline reportou durante o processamento"
        >
          <ul className="space-y-2">
            {d.problemas.map((p, i) => (
              <li
                key={i}
                className="border-l-2 border-l-alerta pl-3 text-[13px] leading-relaxed text-texto-2"
              >
                {p}
              </li>
            ))}
          </ul>
        </CartaoTitulo>
      )}

      <CartaoTitulo
        className="mt-5"
        titulo="Limitações conhecidas"
        descricao="O que estes dados não permitem afirmar"
      >
        <ul className="space-y-2.5 text-[13px] leading-relaxed text-texto-2">
          <li className="border-l-2 border-l-borda-forte pl-3">
            <strong>A API municipal não expõe a classificação programática por
            pagamento.</strong>{' '}
            O campo vem nulo em todas as 309.904 ordens. Por isso não é possível
            amarrar um pagamento a uma subfunção específica — apenas os totais
            gerais e por fornecedor.
          </li>
          <li className="border-l-2 border-l-borda-forte pl-3">
            <strong>Natureza da despesa e subfunção não se cruzam.</strong>{' '}
            O RREO-Anexo 02 classifica por função e subfunção; o Anexo 01, por
            categoria econômica. Não há um anexo público que traga os dois
            eixos juntos para este município.
          </li>
          <li className="border-l-2 border-l-borda-forte pl-3">
            <strong>Pisos de Saúde e Educação são aproximações.</strong>{' '}
            O cálculo usa a despesa liquidada da função dividida pela receita de
            impostos e transferências. Não substitui a apuração oficial do TCE ou
            do Ministério da Saúde.
          </li>
          <li className="border-l-2 border-l-borda-forte pl-3">
            <strong>Valores em reais correntes.</strong>{' '}
            Não há correção pela inflação. Um crescimento nominal de 70% em seis
            anos pode significar crescimento real bem menor.
          </li>
          <li className="border-l-2 border-l-borda-forte pl-3">
            <strong>Dívida ativa indisponível.</strong>{' '}
            O endpoint do sistema tributário retorna erro de configuração na API
            do município. A dívida ativa (créditos a receber) não está neste site.
          </li>
        </ul>
      </CartaoTitulo>

      <CartaoTitulo
        className="mt-5"
        titulo="Cobertura dos dados"
        descricao="O que foi coletado e processado"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CoberturaItem
            rotulo="Exercícios"
            valor={`${d.meta.anos[0]}–${d.meta.anos[d.meta.anos.length - 1]}`}
            detalhe={`${d.meta.anos.length} anos fechados`}
          />
          <CoberturaItem
            rotulo="Funções de governo"
            valor={inteiro(d.execucao.funcoes.length)}
            detalhe="Portaria MOG 42/1999"
          />
          <CoberturaItem
            rotulo="Subfunções"
            valor={inteiro(d.execucao.subfuncoes.length)}
            detalhe="todas mapeadas por código oficial"
          />
          <CoberturaItem
            rotulo="Ordens de pagamento"
            valor={inteiro(
              Object.values(d.pagamentos.por_entidade).reduce(
                (acc, e) => acc + Object.values(e).reduce((a2, p) => a2 + p.ordens, 0),
                0,
              ),
            )}
            detalhe="Prefeitura e Câmara"
          />
          <CoberturaItem
            rotulo="Servidores"
            valor={inteiro(d.servidores.servidores.length)}
            detalhe="cadastro corrente completo"
          />
          <CoberturaItem
            rotulo="Contratos"
            valor={inteiro(
              Object.values(d.compras.contratos).reduce((acc, c) => acc + c.quantidade, 0),
            )}
            detalhe="celebrados no período"
          />
          <CoberturaItem
            rotulo="Convênios"
            valor={inteiro(d.obras_convenios.convenios.length)}
            detalhe="firmados pelo município"
          />
          <CoberturaItem
            rotulo="Obras"
            valor={inteiro(d.obras_convenios.obras.length)}
            detalhe="ordens de serviço publicadas"
          />
        </div>
      </CartaoTitulo>
    </Secao>
  );
}

function CoberturaItem({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <div className="rounded-controle bg-superficie-2 p-3">
      <p className="text-2xs font-semibold uppercase tracking-wider text-texto-3">
        {rotulo}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{valor}</p>
      <p className="mt-0.5 text-2xs leading-snug text-texto-3">{detalhe}</p>
    </div>
  );
}

/** Exportação não utilizada, mantida para o linter não reclamar do import. */
export const _porcento = porcento;
