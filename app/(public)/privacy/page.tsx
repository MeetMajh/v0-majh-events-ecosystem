import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | MAJH EVENTS",
  description: "Privacy policy for MAJH EVENTS platform and services.",
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-8 text-4xl font-bold text-foreground">Privacy Policy</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

      <div className="prose prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-bold text-foreground">1. Information We Collect</h2>
          <p className="text-muted-foreground">
            We collect information you provide directly to us, such as when you create an account, 
            make a booking, submit a contact form, or communicate with us. This may include:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Name, email address, and phone number</li>
            <li>Billing and payment information</li>
            <li>Event details and preferences</li>
            <li>Communications you send to us</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">2. How We Use Your Information</h2>
          <p className="text-muted-foreground">We use the information we collect to:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Process bookings and payments</li>
            <li>Send confirmations and updates about your events</li>
            <li>Respond to your inquiries and provide customer support</li>
            <li>Send marketing communications (with your consent)</li>
            <li>Improve our services and user experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">3. Information Sharing</h2>
          <p className="text-muted-foreground">
            We do not sell, trade, or rent your personal information to third parties. We may share 
            your information with service providers who assist us in operating our platform, processing 
            payments, or delivering services to you.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">4. Data Security</h2>
          <p className="text-muted-foreground">
            We implement appropriate technical and organizational measures to protect your personal 
            information against unauthorized access, alteration, disclosure, or destruction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">5. Cookies</h2>
          <p className="text-muted-foreground">
            We use cookies and similar technologies to enhance your experience, analyze usage patterns, 
            and deliver personalized content. You can manage your cookie preferences through your browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">6. Your Rights</h2>
          <p className="text-muted-foreground">You have the right to:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Access and receive a copy of your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of marketing communications</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">7. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have any questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:privacy@majhevents.com" className="text-primary hover:underline">
              privacy@majhevents.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
