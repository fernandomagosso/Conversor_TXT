import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

const App = () => {
  const [headers, setHeaders] = useState<string[]>(['Coluna 1', 'Coluna 2']);
  const [data, setData] = useState<string[][]>([['', '']]);
  const [fileName, setFileName] = useState('dados');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [numFields, setNumFields] = useState(headers.length);
  const [numRecords, setNumRecords] = useState(data.length);


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
    if (rows.length === 0) {
        setHeaders([]);
        setData([]);
        return;
    }
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
        setHeaders([]);
        setData([]);
        return;
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
    setHeaders([...headers, `Campo ${headers.length + 1}`]);
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

  const handleClearData = () => {
    if(window.confirm('Tem certeza de que deseja limpar todos os dados da tabela?')) {
        setHeaders([]);
        setData([]);
        setFileName('dados');
    }
  };
  
  const openAdjustModal = () => {
    setNumFields(headers.length);
    setNumRecords(data.length);
    setIsAdjustModalOpen(true);
  };

  const handleAdjustTable = () => {
    const targetCols = numFields;
    const targetRows = numRecords;

    if (targetCols <= 0 || targetRows <= 0) {
        setHeaders([]);
        setData([]);
        setIsAdjustModalOpen(false);
        return;
    }

    const currentCols = headers.length;
    let newHeaders = [...headers];
    let newData = data.map(row => [...row]);

    // Adjust Columns
    if (targetCols > currentCols) {
        for (let i = currentCols; i < targetCols; i++) {
            newHeaders.push(`Campo ${i + 1}`);
            newData.forEach(row => row.push(''));
        }
    } else if (targetCols < currentCols) {
        newHeaders = newHeaders.slice(0, targetCols);
        newData = newData.map(row => row.slice(0, targetCols));
    }
    
    const finalColCount = newHeaders.length;
    const currentRows = newData.length;

    // Adjust Rows
    if (targetRows > currentRows) {
        const emptyRow = Array(finalColCount).fill('');
        for (let i = currentRows; i < targetRows; i++) {
            newData.push([...emptyRow]);
        }
    } else if (targetRows < currentRows) {
        newData = newData.slice(0, targetRows);
    }
    
    setHeaders(newHeaders);
    setData(newData);
    setIsAdjustModalOpen(false);
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
    const escapeCsvCell = (cell: string | undefined | null): string => {
        if (cell === null || cell === undefined) {
          return '';
        }
        const str = String(cell);
        // Se a string contém o separador, aspas ou quebra de linha, ela precisa ser colocada entre aspas
        if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          const escapedStr = str.replace(/"/g, '""');
          return `"${escapedStr}"`;
        }
        return str;
    };

    const headerString = headers.map(escapeCsvCell).join(';');
    const rowStrings = data.map(row => row.map(escapeCsvCell).join(';'));
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
  
  const handleConnectAi = () => {
    const key = prompt("Por favor, insira sua Chave de API (API Key) do Google AI Studio:", "");
    if (key) {
        setApiKey(key);
        setIsAiEnabled(true);
    }
  };

  const handleGenerateData = async () => {
    if (!apiKey) {
      setError('A chave de API não foi configurada.');
      return;
    }
    if (!aiPrompt.trim() || headers.length === 0) {
      setError('Por favor, defina os cabeçalhos e descreva os dados a serem gerados.');
      return;
    }
    
    setIsGenerating(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey });

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

  const hasData = data.length > 0 && headers.length > 0;

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
            <span>&#x2795;</span> Adicionar Registro
        </button>
        <button onClick={handleAddColumn} className="btn btn-primary">
            <span>&#x2795;</span> Adicionar Campo
        </button>
         <button onClick={openAdjustModal} className="btn btn-primary">
            <span>&#x2699;&#xFE0F;</span> Ajustar Tabela
        </button>
        <button onClick={handleClearData} className="btn btn-danger">
             <span>&#x1F5D1;&#xFE0F;</span> Limpar Dados
        </button>
        {!isAiEnabled && (
            <button onClick={handleConnectAi} className="btn btn-primary">
                ✨ Conectar IA
            </button>
        )}
      </div>
      
      {isAiEnabled && (
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
      )}

      {hasData ? (
        <>
            <div className="table-container" role="region" aria-labelledby="table-caption">
                <table className="data-table" aria-label="Tabela de dados editável">
                    <caption id="table-caption" className="sr-only">Tabela de dados editável em visualização transposta. Campos são linhas e registros são colunas.</caption>
                    <thead>
                        <tr>
                            <th scope="col" aria-label="Campos">Campos</th>
                            {data.map((_, rowIndex) => (
                                <th key={rowIndex} scope="col">
                                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px'}}>
                                        <span>Registro {rowIndex + 1}</span>
                                        <button onClick={() => handleDeleteRow(rowIndex)} className="btn btn-danger" aria-label={`Excluir registro ${rowIndex + 1}`}>&#x1F5D1;</button>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {headers.map((header, colIndex) => (
                            <tr key={colIndex}>
                                <th scope="row">
                                    <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                                        <input
                                            type="text"
                                            value={header}
                                            onChange={(e) => handleHeaderChange(colIndex, e.target.value)}
                                            aria-label={`Nome do campo ${header}`}
                                        />
                                        <button onClick={() => handleDeleteColumn(colIndex)} className="btn btn-danger" aria-label={`Excluir campo ${header}`}>&#x1F5D1;</button>
                                    </div>
                                </th>
                                {data.map((row, rowIndex) => (
                                    <td key={rowIndex}>
                                        <input
                                            type="text"
                                            value={row[colIndex] ?? ''}
                                            onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                            aria-label={`Registro ${rowIndex + 1}, Campo ${header}`}
                                        />
                                    </td>
                                ))}
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
          <p>Nenhum dado para exibir. Faça o upload de um arquivo ou adicione registros e campos para começar.</p>
        </div>
      )}

      {isAdjustModalOpen && (
        <div className="modal-backdrop">
            <div className="modal">
                <div className="modal-header">
                    <h2>Ajustar Dimensões da Tabela</h2>
                    <button onClick={() => setIsAdjustModalOpen(false)} className="btn-close" aria-label="Fechar modal">&times;</button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label htmlFor="num-fields">Número de Campos (Colunas):</label>
                        <input
                            id="num-fields"
                            type="number"
                            className="input-field"
                            value={numFields}
                            onChange={(e) => setNumFields(parseInt(e.target.value, 10))}
                            min="0"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="num-records">Número de Registros (Linhas):</label>
                        <input
                            id="num-records"
                            type="number"
                            className="input-field"
                            value={numRecords}
                            onChange={(e) => setNumRecords(parseInt(e.target.value, 10))}
                            min="0"
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button onClick={() => setIsAdjustModalOpen(false)} className="btn btn-secondary">Cancelar</button>
                    <button onClick={handleAdjustTable} className="btn btn-primary">Aplicar</button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);