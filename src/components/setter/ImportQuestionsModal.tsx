import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Question, QuestionType } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Star
} from 'lucide-react';

interface ImportQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
  examTitle: string;
  currentQuestionsCount: number;
  onSuccess: () => void;
}

interface ParsedQuestionRow {
  index: number;
  title: string;
  type: QuestionType;
  marks: number;
  options: string[];
  correctAnswer: string;
  isMandatory: boolean;
  explanation: string;
  rubric: string;
  isValid: boolean;
  validationErrors: string[];
  selected: boolean;
}

export const ImportQuestionsModal: React.FC<ImportQuestionsModalProps> = ({
  isOpen,
  onClose,
  examId,
  examTitle,
  currentQuestionsCount,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedQuestionRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // --- Generate & Download Sample Excel (.xlsx) Template ---
  const handleDownloadExcelTemplate = () => {
    const sampleData = [
      {
        'Question Title': 'Which data structure operates on a Last-In, First-Out (LIFO) principle?',
        'Type': 'mcq',
        'Option A': 'Queue',
        'Option B': 'Stack',
        'Option C': 'Linked List',
        'Option D': 'Binary Tree',
        'Correct Answer': 'Stack',
        'Marks': 2,
        'Compulsory (Must Attend)': 'Yes',
        'Explanation': 'A stack is a linear data structure that follows the LIFO principle.'
      },
      {
        'Question Title': 'HTTP is a stateful application layer protocol.',
        'Type': 'boolean',
        'Option A': 'True',
        'Option B': 'False',
        'Option C': '',
        'Option D': '',
        'Correct Answer': 'False',
        'Marks': 1,
        'Compulsory (Must Attend)': 'No',
        'Explanation': 'HTTP is stateless by design.'
      },
      {
        'Question Title': 'What is the time complexity of binary search on a sorted array of size n?',
        'Type': 'mcq',
        'Option A': 'O(n)',
        'Option B': 'O(n log n)',
        'Option C': 'O(log n)',
        'Option D': 'O(1)',
        'Correct Answer': 'O(log n)',
        'Marks': 2,
        'Compulsory (Must Attend)': 'Yes',
        'Explanation': 'Binary search halves the search space at each step, yielding logarithmic complexity.'
      },
      {
        'Question Title': 'JavaScript is a statically-typed compiled language.',
        'Type': 'boolean',
        'Option A': 'True',
        'Option B': 'False',
        'Option C': '',
        'Option D': '',
        'Correct Answer': 'False',
        'Marks': 1,
        'Compulsory (Must Attend)': 'No',
        'Explanation': 'JavaScript is dynamically typed and interpreted/JIT compiled.'
      },
      {
        'Question Title': 'Which protocol is primarily used for secure web data transmission?',
        'Type': 'mcq',
        'Option A': 'FTP',
        'Option B': 'HTTPS',
        'Option C': 'SMTP',
        'Option D': 'Telnet',
        'Correct Answer': 'HTTPS',
        'Marks': 2,
        'Compulsory (Must Attend)': 'No',
        'Explanation': 'HTTPS encrypts communications using TLS/SSL.'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

    // Auto-fit column widths
    worksheet['!cols'] = [
      { wch: 65 }, // Question Title
      { wch: 12 }, // Type
      { wch: 18 }, // Option A
      { wch: 18 }, // Option B
      { wch: 18 }, // Option C
      { wch: 18 }, // Option D
      { wch: 18 }, // Correct Answer
      { wch: 8 },  // Marks
      { wch: 24 }, // Compulsory
      { wch: 45 }, // Explanation
    ];

    XLSX.writeFile(workbook, `Exam_Questions_Sample_Template.xlsx`);
  };

  // --- Generate & Download Sample CSV Template ---
  const handleDownloadCsvTemplate = () => {
    const headers = [
      'Question Title',
      'Type',
      'Option A',
      'Option B',
      'Option C',
      'Option D',
      'Correct Answer',
      'Marks',
      'Compulsory (Must Attend)',
      'Explanation'
    ];

    const rows = [
      [
        '"Which data structure operates on a Last-In, First-Out (LIFO) principle?"',
        'mcq',
        '"Queue"',
        '"Stack"',
        '"Linked List"',
        '"Binary Tree"',
        '"Stack"',
        '2',
        '"Yes"',
        '"Stack operates on LIFO principle"'
      ],
      [
        '"HTTP is a stateful application layer protocol."',
        'boolean',
        '"True"',
        '"False"',
        '""',
        '""',
        '"False"',
        '1',
        '"No"',
        '"HTTP is stateless"'
      ]
    ];

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Exam_Questions_Sample_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Parse Uploaded File ---
  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setParsing(true);
    setImportError(null);
    setSuccessCount(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rawJson.length === 0) {
        throw new Error('The uploaded file contains no data or rows.');
      }

      const rows: ParsedQuestionRow[] = rawJson.map((row, idx) => {
        // Normalize keys (case-insensitive & trimmed)
        const normalized: Record<string, string> = {};
        Object.keys(row).forEach((k) => {
          normalized[k.trim().toLowerCase()] = String(row[k] ?? '').trim();
        });

        // Question Title
        const title =
          normalized['question title'] ||
          normalized['title'] ||
          normalized['question'] ||
          normalized['prompt'] ||
          normalized['item'] ||
          '';

        // Question Type
        const rawType = (
          normalized['type'] ||
          normalized['question type'] ||
          normalized['qtype'] ||
          'mcq'
        ).toLowerCase();

        let type: QuestionType = 'mcq';
        if (rawType.includes('bool') || rawType.includes('true') || rawType === 'tf') {
          type = 'boolean';
        } else if (rawType.includes('sub') || rawType.includes('essay') || rawType.includes('desc')) {
          type = 'subjective';
        } else {
          type = 'mcq';
        }

        // Options
        const optA = normalized['option a'] || normalized['option 1'] || normalized['opt a'] || normalized['a'] || '';
        const optB = normalized['option b'] || normalized['option 2'] || normalized['opt b'] || normalized['b'] || '';
        const optC = normalized['option c'] || normalized['option 3'] || normalized['opt c'] || normalized['c'] || '';
        const optD = normalized['option d'] || normalized['option 4'] || normalized['opt d'] || normalized['d'] || '';

        let options: string[] = [];
        if (type === 'mcq') {
          options = [optA, optB, optC, optD].filter(Boolean);
          if (options.length === 0) {
            // Default 4 fallback options if not provided
            options = ['Option A', 'Option B', 'Option C', 'Option D'];
          }
        } else if (type === 'boolean') {
          options = ['True', 'False'];
        }

        // Correct Answer
        let correctAnswer =
          normalized['correct answer'] ||
          normalized['answer'] ||
          normalized['correct option'] ||
          normalized['key'] ||
          '';

        // Auto-map single-letter keys (A -> optA, B -> optB, etc.)
        if (type === 'mcq' && correctAnswer.length === 1) {
          const letter = correctAnswer.toUpperCase();
          if (letter === 'A' && optA) correctAnswer = optA;
          else if (letter === 'B' && optB) correctAnswer = optB;
          else if (letter === 'C' && optC) correctAnswer = optC;
          else if (letter === 'D' && optD) correctAnswer = optD;
        } else if (type === 'boolean') {
          const lower = correctAnswer.toLowerCase();
          if (lower === 't' || lower === 'true' || lower === '1') correctAnswer = 'True';
          else if (lower === 'f' || lower === 'false' || lower === '0') correctAnswer = 'False';
        }

        // Marks
        const rawMarks = Number(normalized['marks'] || normalized['points'] || normalized['mark'] || 1);
        const marks = isNaN(rawMarks) || rawMarks <= 0 ? 1 : rawMarks;

        // Compulsory / Must Attend
        const rawCompulsory = (
          normalized['compulsory (must attend)'] ||
          normalized['compulsory'] ||
          normalized['must attend'] ||
          normalized['mandatory'] ||
          ''
        ).toLowerCase();
        const isMandatory =
          rawCompulsory === 'yes' ||
          rawCompulsory === 'true' ||
          rawCompulsory === 'y' ||
          rawCompulsory === '1';

        // Explanation / Rubric
        const explanation =
          normalized['explanation'] ||
          normalized['solution'] ||
          normalized['rationale'] ||
          '';
        const rubric = normalized['rubric'] || '';

        // Validation
        const validationErrors: string[] = [];
        if (!title) validationErrors.push('Missing question title / prompt');
        if (!correctAnswer) validationErrors.push('Missing correct answer key');
        if (type === 'mcq' && options.length < 2) {
          validationErrors.push('MCQ must have at least 2 options');
        }

        return {
          index: idx + 1,
          title,
          type,
          marks,
          options,
          correctAnswer,
          isMandatory,
          explanation,
          rubric,
          isValid: validationErrors.length === 0,
          validationErrors,
          selected: validationErrors.length === 0,
        };
      });

      setParsedRows(rows);
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || 'Failed to read Excel / CSV file.');
      setParsedRows([]);
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Toggle selection
  const handleToggleSelectRow = (index: number) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.index === index ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setParsedRows((prev) => prev.map((r) => ({ ...r, selected: select && r.isValid })));
  };

  // --- Execute Batch Import ---
  const handleExecuteImport = async () => {
    const selectedRows = parsedRows.filter((r) => r.selected && r.isValid);
    if (selectedRows.length === 0) {
      alert('No valid questions selected for import.');
      return;
    }

    try {
      setImporting(true);
      setImportError(null);

      const timestamp = new Date().toISOString();
      const newQuestions: Question[] = selectedRows.map((r, i) => {
        const qId = 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7) + '_' + i;
        return {
          id: qId,
          examId,
          order: currentQuestionsCount + i + 1,
          title: r.title,
          type: r.type,
          options: r.options,
          correctAnswer: r.correctAnswer,
          marks: r.marks,
          isMandatory: r.isMandatory,
          explanation: r.explanation,
          rubric: r.rubric,
          createdAt: timestamp,
        };
      });

      await examService.batchSaveQuestions(examId, newQuestions);

      setSuccessCount(newQuestions.length);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Import failed:', err);
      setImportError(err.message || 'Failed to import questions to exam.');
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = parsedRows.filter((r) => r.selected).length;
  const validCount = parsedRows.filter((r) => r.isValid).length;
  const compulsoryCount = parsedRows.filter((r) => r.selected && r.isMandatory).length;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>Import MCQ & True/False Questions from Excel / CSV</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
                  Paper Setter Tool
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Target Exam: <strong className="text-slate-700 dark:text-slate-300">{examTitle}</strong> (Currently {currentQuestionsCount} questions)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Download Sample Templates Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Need a ready-made template? Download our official schema</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                Pre-formatted columns for MCQ Options (A, B, C, D), Correct Answer Key, Marks, and Compulsory Question flags.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadExcelTemplate}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50 shadow-2xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-purple-600 dark:text-purple-400 font-bold hover:bg-purple-50 shadow-2xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV Template</span>
              </button>
            </div>
          </div>

          {/* Upload Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[0.99]'
                : file
                ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {file ? file.name : 'Click to select or drag & drop Excel / CSV file here'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
                </p>
              </div>
            </div>
          </div>

          {/* Parsing status / Error */}
          {parsing && (
            <div className="p-3 text-center text-xs text-indigo-600 font-semibold animate-pulse">
              Reading and validating question data...
            </div>
          )}

          {importError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2 font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Successfully imported {successCount} questions into "{examTitle}"!</span>
            </div>
          )}

          {/* Parsed Questions Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Parsed Questions ({parsedRows.length})
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                    {validCount} Ready to Import
                  </span>
                  {compulsoryCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold flex items-center space-x-1">
                      <Star className="w-2.5 h-2.5 fill-current text-amber-600" />
                      <span>{compulsoryCount} Compulsory (Must Attend)</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                  >
                    Select All Valid
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="text-slate-500 hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCount > 0 && selectedCount === validCount}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="py-2.5 px-2 w-8">#</th>
                      <th className="py-2.5 px-3 font-semibold">Question Prompt</th>
                      <th className="py-2.5 px-3 font-semibold">Type</th>
                      <th className="py-2.5 px-3 font-semibold">Correct Answer Key</th>
                      <th className="py-2.5 px-2 font-semibold text-center">Marks</th>
                      <th className="py-2.5 px-3 font-semibold">Regulations</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.index}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                          !row.isValid ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={!row.isValid}
                            onChange={() => handleToggleSelectRow(row.index)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-30 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-slate-400 font-mono text-[11px]">{row.index}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white max-w-xs truncate" title={row.title}>
                          {row.title || <span className="text-rose-500 italic">Empty question prompt</span>}
                          {row.options.length > 0 && (
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              Opts: {row.options.join(' • ')}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            row.type === 'mcq'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-700 dark:text-emerald-400 max-w-[140px] truncate" title={row.correctAnswer}>
                          {row.correctAnswer || <span className="text-rose-500 italic">Missing key</span>}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-indigo-600">
                          {row.marks}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.isMandatory ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800 flex items-center space-x-1 w-max">
                              <Star className="w-2.5 h-2.5 fill-current text-amber-600" />
                              <span>Compulsory</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium">Optional</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {row.isValid ? (
                            <span className="text-emerald-600 font-bold text-[11px] flex items-center justify-end space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Valid</span>
                            </span>
                          ) : (
                            <span className="text-rose-600 font-bold text-[10px] flex items-center justify-end space-x-1" title={row.validationErrors.join(', ')}>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{row.validationErrors[0]}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="text-slate-500">
            {parsedRows.length > 0 ? (
              <span>
                Selected: <strong className="text-slate-900 dark:text-white">{selectedCount}</strong> of {validCount} valid questions
              </span>
            ) : (
              <span>Upload an Excel or CSV file to review and import</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={importing || selectedCount === 0}
              onClick={handleExecuteImport}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-900/20 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{importing ? 'Importing Questions...' : `Import ${selectedCount} Questions`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
