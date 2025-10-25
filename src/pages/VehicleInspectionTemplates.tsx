import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TemplateEditorAdvanced } from "@/components/VehicleInspection/TemplateEditorAdvanced";

interface ChecklistItem {
  id: string;
  name: string;
  required: boolean;
  requiresPhoto: boolean;
  allowReportProblem: boolean;
}

interface ChecklistCategory {
  category: string;
  categoryLabel: string;
  items: ChecklistItem[];
}

interface Template {
  id: string;
  name: string;
  vehicle_type: 'car' | 'motorcycle';
  items: ChecklistCategory[];
  active: boolean;
  created_at: string;
}

const VehicleInspectionTemplates = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicle_inspection_templates")
        .select("*")
        .order("vehicle_type", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setTemplates((data as any) || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate({
      id: '',
      name: 'Novo Template',
      vehicle_type: 'car',
      items: [
        {
          category: 'motor',
          categoryLabel: 'Motor',
          items: [
            {
              id: 'oil_level',
              name: 'Nível de óleo do motor',
              required: true,
              requiresPhoto: false,
              allowReportProblem: true
            }
          ]
        }
      ],
      active: true,
      created_at: new Date().toISOString()
    });
    setShowEditor(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleDuplicateTemplate = async (template: Template) => {
    try {
      const { error } = await supabase
        .from("vehicle_inspection_templates")
        .insert([{
          name: `${template.name} (Cópia)`,
          vehicle_type: template.vehicle_type,
          items: template.items as any,
          active: false
        }]);

      if (error) throw error;

      toast({
        title: "Template duplicado",
        description: "Template duplicado com sucesso",
      });
      fetchTemplates();
    } catch (error) {
      console.error("Error duplicating template:", error);
      toast({
        title: "Erro",
        description: "Erro ao duplicar template",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplateId) return;

    try {
      const { error } = await supabase
        .from("vehicle_inspection_templates")
        .delete()
        .eq("id", deletingTemplateId);

      if (error) throw error;

      toast({
        title: "Template excluído",
        description: "Template excluído com sucesso",
      });
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir template",
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setDeletingTemplateId(null);
    }
  };

  const handleSaveTemplate = async (template: Template) => {
    try {
      if (template.id) {
        // Update existing
        const { error } = await supabase
          .from("vehicle_inspection_templates")
          .update({
            name: template.name,
            vehicle_type: template.vehicle_type,
            items: template.items as any,
            active: template.active
          })
          .eq("id", template.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("vehicle_inspection_templates")
          .insert([{
            name: template.name,
            vehicle_type: template.vehicle_type,
            items: template.items as any,
            active: template.active
          }]);

        if (error) throw error;
      }

      toast({
        title: "Template salvo",
        description: "Template salvo com sucesso",
      });
      setShowEditor(false);
      fetchTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar template",
        variant: "destructive",
      });
    }
  };

  const getTotalItems = (template: Template) => {
    return template.items.reduce((sum, category) => sum + category.items.length, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/vehicles')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Templates de Checklist Veicular</h1>
              <p className="text-sm text-muted-foreground">
                {templates.length} template{templates.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button onClick={handleCreateTemplate}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Template
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <Badge variant={template.vehicle_type === 'car' ? 'default' : 'secondary'}>
                      {template.vehicle_type === 'car' ? 'Carro' : 'Moto'}
                    </Badge>
                    {template.active && (
                      <Badge className="bg-tactical-green text-white">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Ativo
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {template.items.length} categoria{template.items.length !== 1 ? 's' : ''} • {getTotalItems(template)} itens
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditTemplate(template)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicateTemplate(template)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDeletingTemplateId(template.id);
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {templates.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum template criado</h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro template de checklist veicular
              </p>
              <Button onClick={handleCreateTemplate}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Template
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Template Editor Dialog */}
      {editingTemplate && (
        <TemplateEditorAdvanced
          template={editingTemplate}
          open={showEditor}
          onOpenChange={setShowEditor}
          onSave={handleSaveTemplate}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VehicleInspectionTemplates;
