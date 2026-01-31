'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from '@/components/ui/dialog';
import { Upload, Download, Trash2, File, Eye, FileText, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
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
  };
}

interface DocumentsTabProps {
  entityType: 'ACCOUNT' | 'LEAD' | 'CONTACT' | 'OPPORTUNITY';
  entityId: string;
}

export function DocumentsTab({ entityType, entityId }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const fetchDocuments = async () => {
    setLoading(true);
    const { data: links } = await supabase
      .from('document_links')
      .select('document_id')
      .eq('linked_to_type', entityType)
      .eq('linked_to_id', entityId);

    if (links && links.length > 0) {
      const documentIds = links.map(l => l.document_id);
      const { data } = await supabase
        .from('documents')
        .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name)')
        .in('id', documentIds)
        .order('created_at', { ascending: false });

      if (data) {
        setDocuments(data);
      }
    } else {
      setDocuments([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [entityId, entityType]);

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast({
        title: t('documents.fail_no_files'),
        description: t('documents.fail_select_at_least_one'),
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}-${i}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: document, error: docError } = await supabase
          .from('documents')
          .insert({
            title: uploadTitle || file.name,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            storage_key: uploadData.path,
            uploaded_by: user?.id,
          })
          .select()
          .single();

        if (docError) throw docError;

        await supabase.from('document_links').insert({
          document_id: document.id,
          linked_to_type: entityType,
          linked_to_id: entityId,
          linked_by: user?.id,
        });
      }

      toast({
        title: t('documents.success_uploaded'),
        description: t('documents.success_count').replace('{count}', selectedFiles.length.toString()),
      });

      setShowUploadDialog(false);
      setUploadTitle('');
      setUploadCategory('');
      setSelectedFiles(null);
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
        title: t('documents.fail_download'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(t('documents.delete_confirm'))) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_key]);

      if (storageError) throw storageError;

      const { error: linkError } = await supabase
        .from('document_links')
        .delete()
        .eq('document_id', doc.id);

      if (linkError) throw linkError;

      const { error: docError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (docError) throw docError;

      toast({
        title: t('documents.success_deleted'),
        description: t('documents.success_deleted_desc'),
      });

      fetchDocuments();
    } catch (error: any) {
      toast({
        title: t('documents.fail_deleted'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">{t('documents.title')}</h3>
          <Button size="sm" onClick={() => setShowUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-1" />
            {t('documents.upload')}
          </Button>
        </div>

        {loading ? (
          <p className="text-center py-4 text-gray-500">{t('documents.loading')}</p>
        ) : documents.length === 0 ? (
          <p className="text-gray-500 text-center py-4">{t('documents.no_documents')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('documents.table.name')}</TableHead>
                <TableHead>{t('documents.table.size')}</TableHead>
                <TableHead>{t('documents.table.uploaded_by')}</TableHead>
                <TableHead>{t('documents.table.date')}</TableHead>
                <TableHead>{t('documents.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{doc.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                  <TableCell>{doc.uploader?.full_name || '-'}</TableCell>
                  <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
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
                        title={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('documents.upload_docs')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('documents.form.title_optional')}</Label>
                <Input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder={t('documents.form.placeholder')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('documents.form.files')}</Label>
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setSelectedFiles(e.target.files)}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xls,.xlsx"
                />
                <p className="text-xs text-gray-500">
                  {t('documents.form.supported')}
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowUploadDialog(false)}
                  disabled={uploading}
                >
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? t('common.uploading') : t('common.upload')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>

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
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
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
    </Card>
  );
}
