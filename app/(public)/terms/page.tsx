import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service | MAJH EVENTS",
  description: "Terms of service for MAJH EVENTS platform and services.",
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-8 text-4xl font-bold text-foreground">Terms of Service</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

      <div className="prose prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-bold text-foreground">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By accessing or using the MAJH EVENTS platform and services, you agree to be bound by these 
            Terms of Service. If you do not agree to these terms, please do not use our services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">2. Services</h2>
          <p className="text-muted-foreground">
            MAJH EVENTS provides event booking, esports tournament management, catering services, and 
            equipment rental services. All services are subject to availability and our discretion.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">3. User Accounts</h2>
          <p className="text-muted-foreground">
            You are responsible for maintaining the confidentiality of your account credentials and for 
            all activities that occur under your account. You must provide accurate and complete information 
            when creating an account.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">4. Bookings and Payments</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>All bookings are subject to availability and confirmation</li>
            <li>Deposits are required to secure event bookings</li>
            <li>Cancellation policies vary by service type and will be communicated at booking</li>
            <li>Payment processing is handled securely through our payment partners</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">5. Equipment Rentals</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Rental equipment must be returned in the same condition as received</li>
            <li>Customers are responsible for any damage or loss during the rental period</li>
            <li>Security deposits may be required for certain equipment</li>
            <li>Late returns may incur additional fees</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">6. Esports and Tournaments</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Tournament rules and formats are set by organizers and must be followed</li>
            <li>Unsportsmanlike conduct may result in disqualification</li>
            <li>Prize distributions are subject to tournament-specific rules</li>
            <li>Age restrictions may apply to certain events</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">7. Code of Conduct</h2>
          <p className="text-muted-foreground">Users agree to:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Treat staff and other users with respect</li>
            <li>Not engage in harassment, discrimination, or abusive behavior</li>
            <li>Follow all venue rules and regulations</li>
            <li>Not use the platform for illegal activities</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">8. Limitation of Liability</h2>
          <p className="text-muted-foreground">
            MAJH EVENTS shall not be liable for any indirect, incidental, special, or consequential 
            damages arising from your use of our services. Our total liability shall not exceed the 
            amount you paid for the specific service in question.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">9. Changes to Terms</h2>
          <p className="text-muted-foreground">
            We reserve the right to modify these terms at any time. Continued use of our services after 
            changes are posted constitutes acceptance of the modified terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">10. Contact</h2>
          <p className="text-muted-foreground">
            For questions about these Terms of Service, please contact us at{" "}
            <a href="mailto:legal@majhevents.com" className="text-primary hover:underline">
              legal@majhevents.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
