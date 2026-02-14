'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileText, Download, Eye, Folder, ChevronRight, Hash, Trash2, Image, FileSpreadsheet, File } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/lib/i18n/language-context';

/* --------------------------------------------------------------------------------
 * TYPES
 * -------------------------------------------------------------------------------- */
interface Document {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  storage_key: string;
  uploader?: {
    full_name: string;
    email: string;
  };
  folder_id?: string;
  folder?: {
    name: string;
  };
  document_type?: string;
}

interface DocFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

interface Account {
  id: string;
  name: string;
}

const DOCUMENT_TYPES = [
  { id: 'INVOICE', label: 'documents.type.invoice' },
  { id: 'CONTRACT', label: 'documents.type.contract' },
  { id: 'PROPOSAL', label: 'documents.type.proposal' },
  { id: 'REPORT', label: 'documents.type.report' },
  { id: 'MARKETING', label: 'documents.type.marketing' },
  { id: 'LEGAL', label: 'documents.type.legal' },
  { id: 'OTHER', label: 'documents.type.other' },
];

/* --------------------------------------------------------------------------------
 * HELPER: Format Bytes
 * -------------------------------------------------------------------------------- */
const formatBytes = (bytes: number, decimals = 2) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export default function FilesPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');

  // New State for Metadata
  const [docType, setDocType] = useState('INVOICE');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  // Initialize with "none" to match SelectItem value
  const [selectedAccountId, setSelectedAccountId] = useState<string>('none');

  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const fetchFolders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('document_folders')
      .select('*')
      .order('name');
    if (data) setFolders(data);
  };

  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('id, name').order('name');
    if (data) setAccounts(data);
  }

  const fetchDocuments = async () => {
    setLoading(true);
    let query = supabase
      .from('documents')
      .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name, email)')
      .order('created_at', { ascending: false });

    if (selectedFolderId) {
      query = query.eq('folder_id', selectedFolderId);
    }

    if (selectedTypeFilter) {
      query = query.eq('document_type', selectedTypeFilter);
    }

    const { data } = await query;

    if (data) setDocuments(data);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchFolders();
      fetchAccounts();
      fetchDocuments();
    }
  }, [user, selectedFolderId, selectedTypeFilter]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  // --------------------------------------------------------------------------------
  // HANDLE UPLOAD (ROBUST VERSION)
  // --------------------------------------------------------------------------------
  const handleUpload = async () => {
    console.log('--- HANDLE UPLOAD START ---');
    if (!user) {
      console.error('User not logged in');
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to upload.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedFile) {
      console.error('No file selected');
      return;
    }

    setUploading(true);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      console.log('Generated fileName for storage:', fileName);

      // 1. Upload to Storage
      console.log('Starting Supabase Storage upload...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, selectedFile);

      if (uploadError) {
        console.error('Storage Upload Error:', uploadError);
        throw new Error(`Storage Error: ${uploadError.message}`);
      }
      console.log('Storage upload success:', uploadData);

      // 2. Call API to create Metadata and Link
      console.log('Calling /api/documents/create-meta...');

      // Determine Account ID (convert "none" to null)
      const finalAccountId = selectedAccountId === 'none' ? null : selectedAccountId;

      const response = await fetch('/api/documents/create-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: {
            title: fileTitle || selectedFile.name,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type,
            storageKey: uploadData.path
          },
          docType, // Maps to Folder Name
          accountId: finalAccountId,
          userId: user.id
        })
      });

      console.log('API Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response Body:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || `API Error: ${response.status}`);
        } catch (e) {
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
      }

      console.log('Upload workflow successful');
      toast({
        title: t('documents.success_uploaded'),
        description: t('documents.success_count').replace('{count}', '1'),
      });

      setShowUploadDialog(false);
      setSelectedFile(null);
      setFileTitle('');
      setDocType('Invoices');
      setSelectedAccountId('none'); // Reset to "none"
      if (fileInputRef.current) fileInputRef.current.value = '';

      fetchDocuments();
      fetchFolders();
    } catch (error: any) {
      console.error('HANDLE UPLOAD EXCEPTION:', error);
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };


  const handleDownload = async (doc: Document) => {
    try {
      console.log('Downloading file:', doc.storage_key);
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.storage_key);

      if (error) {
        console.error('Storage Download Error:', error);
        throw error;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        variant: 'destructive',
        description: error.message
      });
    }
  };

  const handlePreview = async (doc: Document) => {
    try {
      console.log('Previewing file:', doc.storage_key);
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.storage_key);

      if (error) {
        console.error('Storage Preview Download Error:', error);
        throw error;
      }

      const url = URL.createObjectURL(data);
      setPreviewDoc(doc);
      setPreviewUrl(url);
      setShowPreviewDialog(true);
    } catch (error: any) {
      console.error('Preview error:', error);
      toast({
        title: t('common.error'),
        variant: 'destructive',
        description: error.message
      });
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(t('common.delete_confirm_record'))) return;

    try {
      // 1. Remove from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_key]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // throw storageError; // Optional: soft fail if storage missing
      }

      // 2. Remove from DB
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      toast({
        title: t('common.success'),
        description: t('message.file_deleted'),
      });

      fetchDocuments();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return <Image className="h-5 w-5 text-blue-600" />;
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel'))
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    if (mimeType?.includes('pdf')) return <FileText className="h-5 w-5 text-red-600" />;
    return <File className="h-5 w-5 text-gray-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setShowPreviewDialog(false);
    setPreviewUrl('');
    setPreviewDoc(null);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* SIDEBAR: FOLDERS */}
      <div className="w-64 border-r bg-muted/10 p-4">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Folder className="h-5 w-5" />
          Folders
        </h2>
        <div className="space-y-1">
          <Button
            variant={selectedFolderId === null ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => setSelectedFolderId(null)}
          >
            All Files
          </Button>
          {folders.map(folder => (
            <Button
              key={folder.id}
              variant={selectedFolderId === folder.id ? "secondary" : "ghost"}
              className="w-full justify-start pl-4"
              onClick={() => setSelectedFolderId(folder.id)}
            >
              {folder.name}
            </Button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('common.files')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('documents.description')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={selectedTypeFilter || 'all'}
              onValueChange={(v) => setSelectedTypeFilter(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('documents.filter_by_type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('documents.type.all')}</SelectItem>
                {DOCUMENT_TYPES.map(type => (
                  <SelectItem key={type.id} value={type.id}>{t(type.label as any)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('documents.upload')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('documents.upload')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">

                  {/* File Selection */}
                  <div className="grid gap-2">
                    <Label htmlFor="file">{t('documents.upload_file')}</Label>
                    <Input
                      id="file"
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                    />
                  </div>

                  {/* Title Input */}
                  <div className="grid gap-2">
                    <Label htmlFor="title">{t('common.title')}</Label>
                    <Input
                      id="title"
                      value={fileTitle}
                      onChange={(e) => setFileTitle(e.target.value)}
                      placeholder="File title"
                    />
                  </div>

                  {/* Document Type (Folder) */}
                  <div className="grid gap-2">
                    <Label>{t('common.type')}</Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('common.select_type')} />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map(type => (
                          <SelectItem key={type.id} value={type.id}>{t(type.label as any)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Link to Account */}
                  <div className="grid gap-2">
                    <Label>Link to Client (Optional)</Label>
                    {/* FIX: Use "none" instead of "" because Radix UI disallows empty strings in values */}
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- None --</SelectItem>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowUploadDialog(false)}
                    disabled={uploading}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedFolderId
                ? folders.find(f => f.id === selectedFolderId)?.name
                : t('common.files')
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                {t('documents.no_files')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>{t('common.uploaded')}</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          {getFileIcon(doc.mime_type)}
                          <span>{doc.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.document_type ? t(`documents.type.${doc.document_type.toLowerCase()}` as any) : (doc.mime_type?.split('/')[1]?.toUpperCase() || 'FILE')}
                      </TableCell>
                      <TableCell>{formatBytes(doc.file_size)}</TableCell>
                      <TableCell>
                        {format(new Date(doc.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {doc.uploader?.full_name || doc.uploader?.email || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(doc)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(doc)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={showPreviewDialog} onOpenChange={(open) => !open && closePreview()}>
          <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{previewDoc?.title}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 w-full mt-4 bg-muted/5 rounded-md overflow-hidden relative border">
              {previewDoc?.mime_type.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt={previewDoc.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title={previewDoc?.title}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
