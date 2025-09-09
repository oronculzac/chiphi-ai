"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Edit,
  Calendar,
  DollarSign,
  Building,
  Tag,
  Loader2
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

interface Receipt {
  id: string
  date: string
  merchant: string
  amount: number
  currency: string
  category: string
  subcategory?: string
  status: string
  confidence: number
  last4?: string
  notes?: string
}

interface ReceiptsResponse {
  receipts: Receipt[]
  total: number
  hasMore: boolean
}

const categories = [
  "All Categories",
  "Food & Dining",
  "Transportation", 
  "Shopping",
  "Entertainment",
  "Healthcare",
  "Utilities",
  "Business"
]

const statusOptions = [
  "All Status",
  "processed",
  "pending",
  "failed"
]

export default function ReceiptsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [selectedStatus, setSelectedStatus] = useState("All Status")
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const { toast } = useToast()

  const fetchReceipts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        search: searchTerm,
        category: selectedCategory,
        status: selectedStatus,
        limit: '50',
        offset: '0'
      })

      const response = await fetch(`/api/receipts?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch receipts')
      }

      const data: ReceiptsResponse = await response.json()
      setReceipts(data.receipts)
      setTotal(data.total)
    } catch (error) {
      console.error('Error fetching receipts:', error)
      toast({
        title: "Error",
        description: "Failed to load receipts. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReceipts()
  }, [searchTerm, selectedCategory, selectedStatus])

  const filteredReceipts = receipts

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return <Badge variant="default" className="bg-green-100 text-green-800">Processed</Badge>
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 95) {
      return <Badge variant="default" className="bg-green-100 text-green-800">{confidence}%</Badge>
    } else if (confidence >= 80) {
      return <Badge variant="secondary">{confidence}%</Badge>
    } else {
      return <Badge variant="destructive">{confidence}%</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search merchants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading receipts...
            </span>
          ) : (
            `Showing ${filteredReceipts.length} of ${total} receipts`
          )}
        </p>
      </div>

      {/* Receipts Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead className="w-24">Amount</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24">Confidence</TableHead>
                  <TableHead className="w-24">Card</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-mono text-sm">
                      {new Date(receipt.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="font-medium">{receipt.merchant}</span>
                          {receipt.notes && (
                            <span className="text-xs text-muted-foreground">{receipt.notes}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono">{receipt.amount.toFixed(2)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">{receipt.category}</span>
                        {receipt.subcategory && (
                          <span className="text-xs text-muted-foreground">{receipt.subcategory}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(receipt.status)}
                    </TableCell>
                    <TableCell>
                      {getConfidenceBadge(receipt.confidence)}
                    </TableCell>
                    <TableCell>
                      {receipt.last4 ? (
                        <span className="font-mono text-sm">****{receipt.last4}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
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

      {filteredReceipts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No receipts found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search criteria or filters.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}