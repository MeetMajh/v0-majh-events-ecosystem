"use server"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer"

// ============================================
// Shared Styles
// ============================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#7c3aed",
  },
  logo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#7c3aed",
  },
  companyInfo: {
    textAlign: "right",
    fontSize: 9,
    color: "#666",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 11,
    color: "#666",
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#7c3aed",
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  label: {
    color: "#666",
    fontSize: 9,
    marginBottom: 2,
  },
  value: {
    fontWeight: "bold",
  },
  grid: {
    flexDirection: "row",
    gap: 40,
  },
  gridCol: {
    flex: 1,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f4f4f5",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  tableCol1: { flex: 4 },
  tableCol2: { flex: 1, textAlign: "right" },
  tableCol3: { flex: 1, textAlign: "right" },
  tableCol4: { flex: 1, textAlign: "right" },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
  },
  totalsSection: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 3,
  },
  totalLabel: {
    width: 120,
    textAlign: "right",
    paddingRight: 20,
    color: "#666",
  },
  totalValue: {
    width: 100,
    textAlign: "right",
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#7c3aed",
    marginTop: 5,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#7c3aed",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#999",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
  },
  notes: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  notesText: {
    fontSize: 9,
    color: "#666",
    lineHeight: 1.5,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
})

// ============================================
// Proposal PDF
// ============================================

interface ProposalItem {
  id: string
  description: string
  quantity: number
  unit_price_cents: number
  line_total_cents: number
  sort_order: number
}

interface ProposalData {
  proposal_number: string
  title: string
  intro_text?: string
  terms_text?: string
  valid_until?: string
  status: string
  subtotal_cents: number
  tax_rate: number
  tax_cents: number
  total_cents: number
  created_at: string
  client?: {
    contact_name: string
    company_name?: string
    email?: string
  }
  items?: ProposalItem[]
}

function ProposalDocument({ proposal }: { proposal: ProposalData }) {
  const formatCurrency = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`

  const statusColor = proposal.status === "accepted" ? "#22c55e" : "#7c3aed"

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>CARBARDMV</Text>
            <Text style={{ fontSize: 9, color: "#666", marginTop: 4 }}>
              Mobile Entertainment & Catering
            </Text>
          </View>
          <View style={styles.companyInfo}>
            <Text>CARBARDMV Events</Text>
            <Text>Washington DC Metro Area</Text>
            <Text>events@carbardmv.com</Text>
            <Text>(301) 555-0123</Text>
          </View>
        </View>

        {/* Title & Status */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <View>
            <Text style={styles.title}>{proposal.title}</Text>
            <Text style={styles.subtitle}>Proposal #{proposal.proposal_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {proposal.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Client & Dates */}
        <View style={[styles.section, styles.grid]}>
          <View style={styles.gridCol}>
            <Text style={styles.sectionTitle}>Prepared For</Text>
            <Text style={styles.value}>{proposal.client?.contact_name || "N/A"}</Text>
            {proposal.client?.company_name && (
              <Text style={{ color: "#666", marginTop: 2 }}>{proposal.client.company_name}</Text>
            )}
            {proposal.client?.email && (
              <Text style={{ color: "#666", marginTop: 2 }}>{proposal.client.email}</Text>
            )}
          </View>
          <View style={[styles.gridCol, { alignItems: "flex-end" }]}>
            <Text style={styles.sectionTitle}>Proposal Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Date: </Text>
              <Text>{new Date(proposal.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Valid Until: </Text>
              <Text>
                {proposal.valid_until
                  ? new Date(proposal.valid_until).toLocaleDateString()
                  : "No expiration"}
              </Text>
            </View>
          </View>
        </View>

        {/* Intro Text */}
        {proposal.intro_text && (
          <View style={styles.notes}>
            <Text style={styles.notesText}>{proposal.intro_text}</Text>
          </View>
        )}

        {/* Line Items Table */}
        <View style={[styles.section, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>Proposal Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.tableCol1]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.tableCol2]}>Qty</Text>
              <Text style={[styles.tableHeaderText, styles.tableCol3]}>Rate</Text>
              <Text style={[styles.tableHeaderText, styles.tableCol4]}>Amount</Text>
            </View>
            {proposal.items
              ?.sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={styles.tableCol1}>{item.description}</Text>
                  <Text style={styles.tableCol2}>{item.quantity}</Text>
                  <Text style={styles.tableCol3}>{formatCurrency(item.unit_price_cents)}</Text>
                  <Text style={styles.tableCol4}>{formatCurrency(item.line_total_cents)}</Text>
                </View>
              ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(proposal.subtotal_cents)}</Text>
          </View>
          {proposal.tax_cents > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({proposal.tax_rate}%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(proposal.tax_cents)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(proposal.total_cents)}</Text>
          </View>
        </View>

        {/* Terms */}
        {proposal.terms_text && (
          <View style={[styles.section, { marginTop: 30 }]}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <Text style={styles.notesText}>{proposal.terms_text}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for considering CARBARDMV for your event!</Text>
          <Text style={{ marginTop: 4 }}>Questions? Contact events@carbardmv.com</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateProposalPDF(proposal: ProposalData): Promise<Buffer> {
  const buffer = await renderToBuffer(<ProposalDocument proposal={proposal} />)
  return Buffer.from(buffer)
}

// ============================================
// Invoice PDF
// ============================================

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price_cents: number
  line_total_cents: number
  sort_order: number
}

interface InvoiceData {
  invoice_number: string
  title: string
  notes?: string
  due_date?: string
  status: string
  subtotal_cents: number
  tax_rate: number
  tax_cents: number
  total_cents: number
  amount_paid_cents: number
  created_at: string
  client?: {
    contact_name: string
    company_name?: string
    email?: string
    address?: string
    city?: string
    state?: string
    zip?: string
  }
  items?: InvoiceItem[]
}

function InvoiceDocument({ invoice }: { invoice: InvoiceData }) {
  const formatCurrency = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`

  const amountDue = invoice.total_cents - invoice.amount_paid_cents
  const isPaid = invoice.status === "paid"
  const statusColor = isPaid ? "#22c55e" : invoice.status === "overdue" ? "#ef4444" : "#f59e0b"

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>CARBARDMV</Text>
            <Text style={{ fontSize: 9, color: "#666", marginTop: 4 }}>
              Mobile Entertainment & Catering
            </Text>
          </View>
          <View style={styles.companyInfo}>
            <Text>CARBARDMV Events</Text>
            <Text>Washington DC Metro Area</Text>
            <Text>billing@carbardmv.com</Text>
            <Text>(301) 555-0123</Text>
          </View>
        </View>

        {/* Title & Status */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.subtitle}>#{invoice.invoice_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {isPaid ? "PAID" : invoice.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Bill To & Invoice Details */}
        <View style={[styles.section, styles.grid]}>
          <View style={styles.gridCol}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text style={styles.value}>{invoice.client?.contact_name || "N/A"}</Text>
            {invoice.client?.company_name && (
              <Text style={{ marginTop: 2 }}>{invoice.client.company_name}</Text>
            )}
            {invoice.client?.address && (
              <View style={{ marginTop: 4, color: "#666" }}>
                <Text>{invoice.client.address}</Text>
                <Text>
                  {invoice.client.city}, {invoice.client.state} {invoice.client.zip}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.gridCol, { alignItems: "flex-end" }]}>
            <Text style={styles.sectionTitle}>Invoice Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Invoice Date: </Text>
              <Text>{new Date(invoice.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Due Date: </Text>
              <Text style={{ color: invoice.status === "overdue" ? "#ef4444" : "#1a1a1a" }}>
                {invoice.due_date
                  ? new Date(invoice.due_date).toLocaleDateString()
                  : "Due on receipt"}
              </Text>
            </View>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={[styles.section, { marginTop: 10 }]}>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.tableCol1]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.tableCol2]}>Qty</Text>
              <Text style={[styles.tableHeaderText, styles.tableCol3]}>Rate</Text>
              <Text style={[styles.tableHeaderText, styles.tableCol4]}>Amount</Text>
            </View>
            {invoice.items
              ?.sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={styles.tableCol1}>{item.description}</Text>
                  <Text style={styles.tableCol2}>{item.quantity}</Text>
                  <Text style={styles.tableCol3}>{formatCurrency(item.unit_price_cents)}</Text>
                  <Text style={styles.tableCol4}>{formatCurrency(item.line_total_cents)}</Text>
                </View>
              ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal_cents)}</Text>
          </View>
          {invoice.tax_cents > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({invoice.tax_rate}%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.tax_cents)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontWeight: "bold" }]}>Total</Text>
            <Text style={[styles.totalValue, { fontWeight: "bold" }]}>
              {formatCurrency(invoice.total_cents)}
            </Text>
          </View>
          {invoice.amount_paid_cents > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: "#22c55e" }]}>Amount Paid</Text>
              <Text style={[styles.totalValue, { color: "#22c55e" }]}>
                -{formatCurrency(invoice.amount_paid_cents)}
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.totalLabel}>Amount Due</Text>
            <Text style={[styles.totalValue, { color: isPaid ? "#22c55e" : "#7c3aed" }]}>
              {formatCurrency(amountDue)}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={[styles.notes, { marginTop: 30 }]}>
            <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Payment Instructions */}
        {!isPaid && (
          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>Payment Instructions</Text>
            <Text style={styles.notesText}>
              Please pay online using the secure payment link sent to your email, or contact us for alternative payment methods.
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business!</Text>
          <Text style={{ marginTop: 4 }}>Questions? Contact billing@carbardmv.com</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateInvoicePDF(invoice: InvoiceData): Promise<Buffer> {
  const buffer = await renderToBuffer(<InvoiceDocument invoice={invoice} />)
  return Buffer.from(buffer)
}
