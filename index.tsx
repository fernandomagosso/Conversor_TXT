import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// Assume process.env.API_KEY is configured in the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const App = () => {
  const [headers, setHeaders] = useState<string[]>(['Coluna 1', 'Coluna 2']);
  const [data, setData] = useState<string[][]>([['', '']]);
  const [fileName, setFileName] = useState('dados');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name.replace(/\.(csv|json)$/i, ''));

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      
      try {
        if (file.name.toLowerCase().endsWith('.json')) {
          parseJson(text);
        } else {
          parseCsv(text);
        }
      } catch (err) {
        alert('Erro ao processar o arquivo. Verifique o formato.');
        console.error(err);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const parseCsv = (text: string) => {
    const rows = text.trim().split(/\r?\n/);
    const newHeaders = rows[0].split(';');
    const newData = rows.slice(1).map(row => {
        const values = row.split(';');
        return Array.from({ length: newHeaders.length }, (_, i) => values[i] || '');
    });
    setHeaders(newHeaders);
    setData(newData);
  };
  
  const parseJson = (text: string) => {
    const jsonData = JSON.parse(text);
    if (!Array.isArray(jsonData) || jsonData.length === 0) {
      throw new Error("JSON deve ser um array de objetos não vazio.");
    }
    const newHeaders = Object.keys(jsonData[0]);
    const newData = jsonData.map(row => 
      newHeaders.map(header => (row[header] !== null && row[header] !== undefined) ? String(row[header]) : '')
    );
    setHeaders(newHeaders);
    setData(newData);
  };

  const handleHeaderChange = (index: number, value: string) => {
    const newHeaders = [...headers];
    newHeaders[index] = value;
    setHeaders(newHeaders);
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newData = [...data];
    newData[rowIndex][colIndex] = value;
    setData(newData);
  };

  const handleAddRow = () => {
    setData([...data, Array(headers.length).fill('')]);
  };
  
  const handleAddColumn = () => {
    setHeaders([...headers, `Coluna ${headers.length + 1}`]);
    setData(data.map(row => [...row, '']));
  };

  const handleDeleteRow = (rowIndex: number) => {
    setData(data.filter((_, index) => index !== rowIndex));
  };
  
  const handleDeleteColumn = (colIndex: number) => {
    if (headers.length <= 1) return;
    setHeaders(headers.filter((_, index) => index !== colIndex));
    setData(data.map(row => row.filter((_, index) => index !== colIndex)));
  };

  const downloadFile = (content: string, extension: 'csv' | 'json') => {
    const mimeType = extension === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;';
    const finalContent = extension === 'csv' ? `\uFEFF${content}` : content;
    const blob = new Blob([finalContent], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.${extension}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCsv = () => {
    const headerString = headers.join(';');
    const rowStrings = data.map(row => row.join(';'));
    const csvContent = [headerString, ...rowStrings].join('\n');
    downloadFile(csvContent, 'csv');
  };

  const handleDownloadJson = () => {
    const jsonData = data.map(row => {
      const rowObj: { [key: string]: string } = {};
      headers.forEach((header, i) => {
        rowObj[header] = row[i];
      });
      return rowObj;
    });
    const jsonContent = JSON.stringify(jsonData, null, 2);
    downloadFile(jsonContent, 'json');
  };

  const handleGenerateData = async () => {
    if (!aiPrompt.trim() || headers.length === 0) {
      setError('Por favor, defina os cabeçalhos e descreva os dados a serem gerados.');
      return;
    }
    
    setIsGenerating(true);
    setError(null);

    try {
      const properties = headers.reduce((acc, header) => {
        if (header.trim()) {
            acc[header.trim()] = { type: Type.STRING, description: `Valor para a coluna ${header}` };
        }
        return acc;
      }, {} as { [key: string]: { type: Type; description: string } });

      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties,
        },
      };

      const finalPrompt = `O usuário quer gerar dados para uma tabela com os seguintes cabeçalhos: ${headers.join(', ')}. O pedido do usuário é: "${aiPrompt}". Gere dados que correspondam a este pedido e se encaixem nos cabeçalhos fornecidos. Retorne apenas o array JSON.`;
      
      const response = await ai.models.generateContent({
         model: "gemini-2.5-flash",
         contents: finalPrompt,
         config: {
           responseMimeType: "application/json",
           responseSchema: schema,
         },
      });

      const jsonStr = response.text;
      const newRowsData = JSON.parse(jsonStr);

      if (Array.isArray(newRowsData)) {
          const formattedNewRows = newRowsData.map(row => headers.map(header => row[header] ?? ''));
          setData(prevData => [...prevData, ...formattedNewRows]);
          setAiPrompt('');
      } else {
        throw new Error('A resposta da IA não foi um array.');
      }

    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao gerar os dados. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const hasData = data.length > 0;

  return (
    <>
      <header>
        <h1>Editor de CSV e JSON Inteligente</h1>
        <p>Faça upload, edite, gere dados com IA e baixe seus arquivos com facilidade.</p>
      </header>

      <div className="controls">
        <label htmlFor="file-upload" className="btn btn-primary file-input-label">
           <span>&#x1F4C2;</span> Upload CSV/JSON
           <input id="file-upload" type="file" accept=".csv, .json, application/json, text/csv" onChange={handleFileUpload} className="file-input" />
        </label>
        <button onClick={handleAddRow} className="btn btn-primary">
            <span>&#x2795;</span> Adicionar Linha
        </button>
        <button onClick={handleAddColumn} className="btn btn-primary">
            <span>&#x2795;</span> Adicionar Coluna
        </button>
      </div>
      
      <div className="ai-section">
        <h2>✨ Geração com IA</h2>
        <div className="ai-controls">
            <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="input-field"
                placeholder="Ex: 5 nomes de clientes com e-mails e cidades"
                aria-label="Descrição para gerar dados com IA"
                disabled={isGenerating}
            />
            <button onClick={handleGenerateData} className="btn btn-primary" disabled={isGenerating}>
                {isGenerating ? 'Gerando...' : 'Gerar Dados'}
            </button>
        </div>
        {error && <p className="error-message">{error}</p>}
      </div>

      {hasData ? (
        <>
            <div className="table-container" role="region" aria-labelledby="table-caption">
                <table className="data-table" aria-label="Tabela de dados editável">
                    <caption id="table-caption" className="sr-only">Tabela de dados editável</caption>
                    <thead>
                        <tr>
                            {headers.map((header, colIndex) => (
                                <th key={colIndex} scope="col">
                                    <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                                        <input
                                            type="text"
                                            value={header}
                                            onChange={(e) => handleHeaderChange(colIndex, e.target.value)}
                                            aria-label={`Cabeçalho da coluna ${colIndex + 1}`}
                                        />
                                        <button onClick={() => handleDeleteColumn(colIndex)} className="btn btn-danger" aria-label={`Excluir coluna ${colIndex + 1}`}>&#x1F5D1;</button>
                                    </div>
                                </th>
                            ))}
                            <th scope="col" className="action-cell" aria-label="Ações"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {row.map((cell, colIndex) => (
                                    <td key={colIndex}>
                                        <input
                                            type="text"
                                            value={cell}
                                            onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                            aria-label={`Linha ${rowIndex + 1}, Coluna ${colIndex + 1}`}
                                        />
                                    </td>
                                ))}
                                <td className="action-cell">
                                    <button onClick={() => handleDeleteRow(rowIndex)} className="btn btn-danger" aria-label={`Excluir linha ${rowIndex + 1}`}>
                                        &#x1F5D1;
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="download-section">
                <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="input-field"
                    placeholder="Nome do arquivo"
                    aria-label="Nome do arquivo para download"
                />
                <button onClick={handleDownloadCsv} className="btn btn-primary">
                    <span>&#x1F4BE;</span> Download CSV
                </button>
                <button onClick={handleDownloadJson} className="btn btn-primary">
                    <span>&#x1F4BE;</span> Download JSON
                </button>
            </div>
        </>
      ) : (
        <div className="placeholder">
          <p>Nenhum dado para exibir. Faça o upload de um arquivo ou adicione linhas para começar.</p>
        </div>
      )}
    </>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);