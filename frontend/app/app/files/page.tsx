'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Upload, Trash2, Download, File, Image, FileSpreadsheet, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/i18n/language-context';

interface Document {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_key: string;
  uploaded_by: string;
  created_at: string;
  uploader?: {
    full_name: string;
    email: string;
  };
}

export default function FilesPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const fetchDocuments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('documents')
      .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name, email)')
      .order('created_at', { ascending: false });

    if (data) setDocuments(data);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('documents').insert({
        title: fileTitle || selectedFile.name,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        storage_key: uploadData.path,
        uploaded_by: user.id,
      });

      if (dbError) throw dbError;

      toast({
        title: t('documents.success_uploaded'),
        description: t('documents.success_count').replace('{count}', '1'),
      });

      setShowUploadDialog(false);
      setSelectedFile(null);
      setFileTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchDocuments();
    } catch (error: any) {
      toast({
        title: t('documents.fail_uploaded'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.storage_key);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
      setPreviewDoc(doc);
      setShowPreviewDialog(true);
    } catch (error: any) {
      toast({
        title: t('documents.fail_download'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setShowPreviewDialog(false);
    setPreviewUrl('');
    setPreviewDoc(null);
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.storage_key);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(t('common.delete_confirm_record'))) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_key]);

      if (storageError) throw storageError;

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
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('files.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle.manage_files')}</p>
        </div>
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              {t('files.upload')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('files.upload')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('common.file')}</Label>
                <label className="relative flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background items-center gap-2 cursor-pointer hover:bg-accent/50 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
                    className="sr-only"
                  />
                  <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-7 px-3 shrink-0">
                    {t('documents.form.choose_files')}
                  </span>
                  <span className="text-muted-foreground text-sm truncate">
                    {selectedFile
                      ? selectedFile.name
                      : t('documents.form.no_file_chosen')}
                  </span>
                </label>
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    {t('common.selected')}: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('common.title')}</Label>
                <Input
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  placeholder={t('common.enter_title')}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadDialog(false);
                    setSelectedFile(null);
                    setFileTitle('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? t('common.uploading') : t('common.upload')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('files.document_library')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">{t('dashboard.loading')}</div>
          ) : documents.length === 0 ? (
            <CardContent className="p-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">{t('files.no_files')}</p>
              <p>{t('message.upload_first_document')}</p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.file_name')}</TableHead>
                  <TableHead>{t('common.size')}</TableHead>
                  <TableHead>{t('common.uploaded_by')}</TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        {getFileIcon(doc.mime_type)}
                        <span className="font-medium">{doc.file_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(doc.file_size || 0)}</TableCell>
                    <TableCell>
                      <div>
                        <p>{doc.uploader?.full_name}</p>
                        <p className="text-sm text-muted-foreground">{doc.uploader?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(doc.created_at), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePreview(doc)}
                          title={t('common.preview')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(doc)}
                          title={t('common.download')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(doc)}
                          className="text-red-600"
                          title={t('common.delete')}
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {previewDoc?.mime_type?.startsWith('image/') ? (
              <img
                src={previewUrl}
                alt={previewDoc.title}
                className="max-w-full h-auto rounded-lg"
              />
            ) : previewDoc?.mime_type === 'application/pdf' ? (
              <iframe
                src={previewUrl}
                className="w-full h-[70vh] border-0 rounded-lg"
                title={previewDoc.title}
              />
            ) : previewDoc?.mime_type?.startsWith('text/') ? (
              <iframe
                src={previewUrl}
                className="w-full h-[70vh] border-0 rounded-lg bg-card"
                title={previewDoc.title}
              />
            ) : (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  {t('common.preview_not_available')}
                </p>
                <Button onClick={() => previewDoc && handleDownload(previewDoc)}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('common.download_to_view')}
                </Button>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => previewDoc && handleDownload(previewDoc)}
            >
              <Download className="h-4 w-4 mr-2" />
              {t('common.download')}
            </Button>
            <Button onClick={closePreview}>{t('common.close')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
