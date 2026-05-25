"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createArticle, updateArticle, deleteArticle } from "@/lib/content-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Eye, 
  Star,
  Trash2,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type Category = {
  id: string
  name: string
  slug: string
  color: string
}

type Article = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  cover_image_url: string | null
  category: string | null
  category_id: string | null
  is_published: boolean
  featured: boolean
  published_at: string | null
}

export function ArticleForm({ 
  categories, 
  article 
}: { 
  categories: Category[]
  article?: Article 
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDeleting, setIsDeleting] = useState(false)
  
  const [title, setTitle] = useState(article?.title || "")
  const [excerpt, setExcerpt] = useState(article?.excerpt || "")
  const [content, setContent] = useState(article?.content || "")
  const [coverImage, setCoverImage] = useState(article?.cover_image_url || "")
  const [categoryId, setCategoryId] = useState(article?.category_id || "")
  const [isPublished, setIsPublished] = useState(article?.is_published || false)
  const [isFeatured, setIsFeatured] = useState(article?.featured || false)

  const isEditing = !!article

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    const formData = new FormData()
    if (article) formData.set("id", article.id)
    formData.set("title", title)
    formData.set("excerpt", excerpt)
    formData.set("content", content)
    formData.set("cover_image_url", coverImage)
    formData.set("category_id", categoryId)
    formData.set("category", categories.find(c => c.id === categoryId)?.slug || "news")
    if (isPublished) formData.set("is_published", "on")
    if (isFeatured) formData.set("featured", "on")

    startTransition(async () => {
      const result = isEditing 
        ? await updateArticle(formData) 
        : await createArticle(formData)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? "Article updated" : "Article created")
        router.push("/dashboard/admin/news")
      }
    })
  }

  async function handleDelete() {
    if (!article) return
    setIsDeleting(true)
    
    const result = await deleteArticle(article.id)
    
    if (result.error) {
      toast.error(result.error)
      setIsDeleting(false)
    } else {
      toast.success("Article deleted")
      router.push("/dashboard/admin/news")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/admin/news">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Articles
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {isEditing && article?.is_published && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/news/${article.slug}`} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Article
              </Link>
            </Button>
          )}
          <Button type="submit" disabled={isPending || !title || !content}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isEditing ? "Update" : "Create"} Article
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Article title"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Brief summary of the article..."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Shown in article previews and search results
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your article content here..."
                  rows={15}
                  className="font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Supports basic formatting. Use blank lines for paragraphs.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="published">Publish</Label>
                </div>
                <Switch
                  id="published"
                  checked={isPublished}
                  onCheckedChange={setIsPublished}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {isPublished 
                  ? "Article will be visible to the public" 
                  : "Article is saved as a draft"
                }
              </p>
              
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="featured">Featured</Label>
                  </div>
                  <Switch
                    id="featured"
                    checked={isFeatured}
                    onCheckedChange={setIsFeatured}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Featured articles appear prominently on the news page
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Category</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-2 w-2 rounded-full" 
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cover Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="Image URL"
              />
              <p className="text-xs text-muted-foreground">
                Enter a URL to an image for the article header
              </p>
              {coverImage && (
                <div className="mt-2 aspect-video overflow-hidden rounded-lg border bg-muted">
                  <img 
                    src={coverImage} 
                    alt="Cover preview" 
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {isEditing && (
            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete Article
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Article?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The article will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </form>
  )
}
