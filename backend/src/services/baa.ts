import * as crypto from 'crypto'
import { baaAgreementRepository, type OrgSignatureData, type VendorSignatureData } from '../repositories/baa.js'
import { organizationRepository } from '../repositories/organizations.js'
import { userRepository } from '../repositories/users.js'
import type { BaaAgreement, BaaStatus } from '@prisma/client'

// ============================================================================
// BAA TEMPLATE CONFIGURATION
// ============================================================================

/**
 * IMPORTANT: PLACEHOLDER DATA - REQUIRES LEGAL REVIEW BEFORE PRODUCTION
 *
 * The following constants contain placeholder values that MUST be reviewed
 * and updated by legal counsel before the application is used with real PHI.
 *
 * Items marked with [PLACEHOLDER] need to be replaced with actual values.
 * Items marked with [LEGAL REVIEW] need counsel signoff.
 */

export const BAA_TEMPLATE_CONFIG = {
  // Template identification
  name: 'hhs-baa-sayitschedule',
  version: '1.0.0',

  // [PLACEHOLDER] Vendor (Business Associate) information
  vendor: {
    legalName: '[PLACEHOLDER: Say It Schedule Legal Entity Name, LLC]',
    address: '[PLACEHOLDER: 123 Business Street, Suite 100, City, ST 12345]',
    contactName: '[PLACEHOLDER: Privacy Officer Name]',
    contactEmail: '[PLACEHOLDER: privacy@sayitschedule.com]',
    contactPhone: '[PLACEHOLDER: (555) 123-4567]'
  },

  // [LEGAL REVIEW] Breach notification timeframe (HIPAA requires 60 days max)
  breachNotificationDays: 30,

  // [LEGAL REVIEW] Agreement term
  termYears: 1,

  // [PLACEHOLDER] Governing law state
  governingLawState: '[PLACEHOLDER: State of Delaware]'
}

/**
 * BAA Template Text
 *
 * Based on HHS Sample Business Associate Agreement Provisions
 * https://www.hhs.gov/hipaa/for-professionals/covered-entities/sample-business-associate-agreement-provisions/index.html
 *
 * [LEGAL REVIEW] This entire template requires legal counsel review and approval
 * before use in production.
 */
export const BAA_TEMPLATE_TEXT = `
BUSINESS ASSOCIATE AGREEMENT

This Business Associate Agreement ("Agreement") is entered into as of the date of last signature below ("Effective Date"), by and between:

COVERED ENTITY: {{ORGANIZATION_NAME}}
Address: {{ORGANIZATION_ADDRESS}}

and

BUSINESS ASSOCIATE: ${BAA_TEMPLATE_CONFIG.vendor.legalName}
Address: ${BAA_TEMPLATE_CONFIG.vendor.address}

(each a "Party" and collectively the "Parties")

RECITALS

WHEREAS, Covered Entity wishes to disclose certain information to Business Associate pursuant to the terms of this Agreement, some of which may constitute Protected Health Information ("PHI");

WHEREAS, Business Associate provides scheduling software services ("Services") that may involve the creation, receipt, maintenance, or transmission of PHI on behalf of Covered Entity;

WHEREAS, Covered Entity and Business Associate intend to protect the privacy and provide for the security of PHI disclosed to Business Associate pursuant to this Agreement in compliance with the Health Insurance Portability and Accountability Act of 1996 ("HIPAA") and its implementing regulations, as amended by the Health Information Technology for Economic and Clinical Health Act ("HITECH Act");

NOW, THEREFORE, in consideration of the mutual promises below and the exchange of information pursuant to this Agreement, the Parties agree as follows:

1. DEFINITIONS

Terms used but not otherwise defined in this Agreement shall have the same meaning as those terms in 45 CFR Parts 160 and 164.

"Breach" shall have the same meaning as the term "breach" in 45 CFR § 164.402.

"Protected Health Information" or "PHI" shall have the same meaning as the term "protected health information" in 45 CFR § 160.103, limited to the information created, received, maintained, or transmitted by Business Associate from or on behalf of Covered Entity.

"Security Incident" shall have the same meaning as the term "security incident" in 45 CFR § 164.304.

2. OBLIGATIONS OF BUSINESS ASSOCIATE

2.1 Permitted Uses and Disclosures. Business Associate agrees to not use or disclose PHI other than as permitted or required by this Agreement or as Required by Law.

2.2 Appropriate Safeguards. Business Associate agrees to use appropriate safeguards to prevent use or disclosure of the PHI other than as provided for by this Agreement.

2.3 Security Safeguards. Business Associate agrees to implement administrative, physical, and technical safeguards that reasonably and appropriately protect the confidentiality, integrity, and availability of the electronic PHI that it creates, receives, maintains, or transmits on behalf of Covered Entity as required by the Security Rule.

2.4 Reporting. Business Associate agrees to report to Covered Entity:
   (a) Any use or disclosure of PHI not provided for by this Agreement of which it becomes aware, including Breaches of Unsecured PHI as required by 45 CFR § 164.410;
   (b) Any Security Incident of which it becomes aware.

Such reports shall be made within ${BAA_TEMPLATE_CONFIG.breachNotificationDays} days of discovery.

2.5 Subcontractors. Business Associate agrees to ensure that any subcontractors that create, receive, maintain, or transmit PHI on behalf of the Business Associate agree to the same restrictions and conditions that apply to the Business Associate with respect to such information.

[PLACEHOLDER: List of current subcontractors requiring BAA coverage]
Current subcontractors processing PHI:
- Amazon Web Services (AWS) - Cloud infrastructure, database hosting, AI/ML services
- [PLACEHOLDER: List any additional subcontractors]

2.6 Access to PHI. Business Associate agrees to provide access, at the request of Covered Entity, to PHI in a Designated Record Set, to Covered Entity or, as directed by Covered Entity, to an Individual, as necessary to meet the requirements of 45 CFR § 164.524.

2.7 Amendment of PHI. Business Associate agrees to make any amendment(s) to PHI in a Designated Record Set that the Covered Entity directs or agrees to pursuant to 45 CFR § 164.526.

2.8 Accounting of Disclosures. Business Associate agrees to document such disclosures of PHI and information related to such disclosures as would be required for Covered Entity to respond to a request by an Individual for an accounting of disclosures of PHI in accordance with 45 CFR § 164.528.

2.9 Government Access. Business Associate agrees to make internal practices, books, and records, including policies and procedures and PHI, relating to the use and disclosure of PHI received from, or created or received by Business Associate on behalf of, Covered Entity available to the Secretary of Health and Human Services for purposes of determining Covered Entity's compliance with the HIPAA Rules.

3. PERMITTED USES AND DISCLOSURES BY BUSINESS ASSOCIATE

3.1 Services. Except as otherwise limited in this Agreement, Business Associate may use or disclose PHI to perform functions, activities, or services for, or on behalf of, Covered Entity as specified in the service agreement between the parties, provided that such use or disclosure would not violate the HIPAA Rules if done by Covered Entity.

3.2 Proper Management. Except as otherwise limited in this Agreement, Business Associate may use PHI for the proper management and administration of the Business Associate or to carry out the legal responsibilities of the Business Associate.

3.3 Data Aggregation. Business Associate may use PHI to provide Data Aggregation services to Covered Entity as permitted by 45 CFR § 164.504(e)(2)(i)(B).

3.4 De-Identification. Business Associate may de-identify PHI in accordance with 45 CFR § 164.514(a)-(c).

4. OBLIGATIONS OF COVERED ENTITY

4.1 Notice of Privacy Practices. Covered Entity shall notify Business Associate of any limitation(s) in its notice of privacy practices in accordance with 45 CFR § 164.520, to the extent that such limitation may affect Business Associate's use or disclosure of PHI.

4.2 Restrictions. Covered Entity shall notify Business Associate of any restriction to the use or disclosure of PHI that Covered Entity has agreed to in accordance with 45 CFR § 164.522.

4.3 Permissions. Covered Entity shall not request Business Associate to use or disclose PHI in any manner that would not be permissible under the HIPAA Rules if done by Covered Entity.

5. DESCRIPTION OF SERVICES

Business Associate provides the following services that involve PHI:

5.1 Scheduling Software: Voice-powered therapy scheduling platform that manages:
   - Staff (therapist) information including names, contact details, certifications
   - Patient information including names, identifiers, session requirements
   - Schedule generation and management
   - Voice transcription for schedule modifications

5.2 Data Processing: The Services may involve:
   - Storage of PHI in encrypted cloud databases
   - Processing of voice commands that may reference patient information
   - AI-assisted schedule optimization using patient and staff data
   - Export of schedules in various formats

[PLACEHOLDER: Confirm this accurately describes all PHI processing activities]

6. TERM AND TERMINATION

6.1 Term. This Agreement shall be effective as of the Effective Date and shall terminate when all PHI provided by Covered Entity to Business Associate, or created or received by Business Associate on behalf of Covered Entity, is destroyed or returned to Covered Entity.

6.2 Termination for Cause. Upon Covered Entity's knowledge of a material breach by Business Associate, Covered Entity shall provide an opportunity for Business Associate to cure the breach or end the violation. If Business Associate does not cure the breach or end the violation within thirty (30) days, Covered Entity may terminate this Agreement.

6.3 Effect of Termination. Upon termination of this Agreement for any reason, Business Associate shall return or destroy all PHI received from Covered Entity, or created or received by Business Associate on behalf of Covered Entity. This provision shall apply to PHI that is in the possession of subcontractors or agents of Business Associate.

7. MISCELLANEOUS

7.1 Regulatory References. A reference in this Agreement to a section in the HIPAA Rules means the section as in effect or as amended.

7.2 Amendment. The Parties agree to take such action as is necessary to amend this Agreement from time to time as is necessary for Covered Entity to comply with the requirements of the HIPAA Rules.

7.3 Survival. The respective rights and obligations of Business Associate under Section 6.3 of this Agreement shall survive the termination of this Agreement.

7.4 Interpretation. Any ambiguity in this Agreement shall be resolved to permit Covered Entity to comply with the HIPAA Rules.

7.5 Governing Law. This Agreement shall be governed by the laws of ${BAA_TEMPLATE_CONFIG.governingLawState}, without regard to its conflict of laws principles.

8. SIGNATURES

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the dates set forth below.

COVERED ENTITY:
{{ORGANIZATION_NAME}}

By: ________________________________
Name: {{ORG_SIGNER_NAME}}
Title: {{ORG_SIGNER_TITLE}}
Date: {{ORG_SIGNED_DATE}}
Email: {{ORG_SIGNER_EMAIL}}

BUSINESS ASSOCIATE:
${BAA_TEMPLATE_CONFIG.vendor.legalName}

By: ________________________________
Name: {{VENDOR_SIGNER_NAME}}
Title: {{VENDOR_SIGNER_TITLE}}
Date: {{VENDOR_SIGNED_DATE}}

---

[LEGAL REVIEW REQUIRED]
This document is based on the HHS sample BAA template and has been customized
for Say It Schedule. Before use in production:
1. Legal counsel must review and approve all provisions
2. All [PLACEHOLDER] items must be replaced with actual values
3. Subcontractor list must be verified and updated
4. State-specific requirements must be reviewed
5. Insurance and indemnification provisions may need to be added
`

/**
 * Generate SHA-256 hash of content
 */
export function generateSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex')
}

/**
 * Get the current BAA template hash
 */
export function getTemplateHash(): string {
  return generateSha256(BAA_TEMPLATE_TEXT)
}

/**
 * Status display information
 */
export const BAA_STATUS_INFO: Record<BaaStatus, { label: string; description: string; color: string }> = {
  not_started: {
    label: 'Not Started',
    description: 'BAA has not been initiated for this organization',
    color: 'gray'
  },
  awaiting_org_signature: {
    label: 'Awaiting Organization Signature',
    description: 'BAA is ready for the organization administrator to review and sign',
    color: 'yellow'
  },
  awaiting_vendor_signature: {
    label: 'Awaiting Vendor Signature',
    description: 'Organization has signed; awaiting Say It Schedule countersignature',
    color: 'blue'
  },
  executed: {
    label: 'Executed',
    description: 'BAA is fully executed and in effect',
    color: 'green'
  },
  voided: {
    label: 'Voided',
    description: 'BAA has been voided and is no longer in effect',
    color: 'red'
  },
  superseded: {
    label: 'Superseded',
    description: 'BAA has been replaced by a newer version',
    color: 'gray'
  }
}

// ============================================================================
// BAA SERVICE
// ============================================================================

export interface BaaStatusResponse {
  hasAgreement: boolean
  agreement: BaaAgreement | null
  statusInfo: typeof BAA_STATUS_INFO[BaaStatus] | null
  templateVersion: string
  canSign: boolean
  canCountersign: boolean
}

export interface SignBaaRequest {
  signerName: string
  signerTitle: string
  signerEmail: string
  consent: boolean
  organizationAddress?: string
}

export class BaaService {
  /**
   * Get the current BAA status for an organization
   */
  async getStatus(organizationId: string): Promise<BaaStatusResponse> {
    const agreement = await baaAgreementRepository.findCurrentByOrganizationId(organizationId)

    if (!agreement) {
      return {
        hasAgreement: false,
        agreement: null,
        statusInfo: null,
        templateVersion: BAA_TEMPLATE_CONFIG.version,
        canSign: true,
        canCountersign: false
      }
    }

    return {
      hasAgreement: true,
      agreement,
      statusInfo: BAA_STATUS_INFO[agreement.status],
      templateVersion: BAA_TEMPLATE_CONFIG.version,
      canSign: agreement.status === 'not_started' || agreement.status === 'awaiting_org_signature',
      canCountersign: agreement.status === 'awaiting_vendor_signature'
    }
  }

  /**
   * Initialize a BAA for an organization (creates record in awaiting_org_signature state)
   */
  async initializeBaa(organizationId: string): Promise<BaaAgreement> {
    // Check if there's already an active BAA
    const existing = await baaAgreementRepository.findCurrentByOrganizationId(organizationId)
    if (existing && existing.status !== 'not_started') {
      throw new Error('Organization already has an active BAA agreement')
    }

    // If there's a not_started BAA, update it; otherwise create new
    if (existing) {
      const updated = await baaAgreementRepository.update(existing.id, {
        status: 'awaiting_org_signature'
      })
      if (!updated) throw new Error('Failed to update BAA agreement')
      return updated
    }

    return baaAgreementRepository.create({
      organizationId,
      status: 'awaiting_org_signature',
      templateName: BAA_TEMPLATE_CONFIG.name,
      templateVersion: BAA_TEMPLATE_CONFIG.version,
      templateSha256: getTemplateHash()
    })
  }

  /**
   * Sign the BAA as the organization (covered entity)
   */
  async signAsOrganization(
    organizationId: string,
    userId: string,
    request: SignBaaRequest,
    ipAddress: string,
    userAgent: string
  ): Promise<BaaAgreement> {
    // Validate consent
    if (!request.consent) {
      throw new Error('You must consent to electronic signature to sign the BAA')
    }

    // Get or initialize the BAA
    let baa = await baaAgreementRepository.findCurrentByOrganizationId(organizationId)

    if (!baa) {
      // Auto-initialize if not exists
      baa = await this.initializeBaa(organizationId)
    }

    // Validate state
    if (baa.status !== 'awaiting_org_signature' && baa.status !== 'not_started') {
      throw new Error(`Cannot sign BAA in current state: ${baa.status}`)
    }

    // Get user info for validation
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new Error('User not found')
    }

    // Verify user belongs to the organization
    if (user.organizationId !== organizationId) {
      throw new Error('User does not belong to this organization')
    }

    // Verify user is an admin
    if (user.role !== 'admin') {
      throw new Error('Only organization administrators can sign the BAA')
    }

    // Record the signature
    const signatureData: OrgSignatureData = {
      orgSignerUserId: userId,
      orgSignerName: request.signerName,
      orgSignerTitle: request.signerTitle,
      orgSignerEmail: request.signerEmail,
      orgSignerIp: ipAddress,
      orgSignerUserAgent: userAgent
    }

    const updated = await baaAgreementRepository.recordOrgSignature(baa.id, signatureData)
    if (!updated) {
      throw new Error('Failed to record signature')
    }

    return updated
  }

  /**
   * Countersign the BAA as the vendor (Say It Schedule)
   */
  async countersignAsVendor(
    baaId: string,
    superadminUserId: string,
    signerName: string,
    signerTitle: string
  ): Promise<BaaAgreement> {
    // Get the BAA
    const baa = await baaAgreementRepository.findById(baaId)
    if (!baa) {
      throw new Error('BAA agreement not found')
    }

    // Validate state
    if (baa.status !== 'awaiting_vendor_signature') {
      throw new Error(`Cannot countersign BAA in current state: ${baa.status}`)
    }

    // Verify superadmin
    const user = await userRepository.findById(superadminUserId)
    if (!user || user.role !== 'super_admin') {
      throw new Error('Only super administrators can countersign BAAs')
    }

    // Generate the executed PDF content (for now, just the filled template)
    const org = await organizationRepository.findById(baa.organizationId)
    if (!org) {
      throw new Error('Organization not found')
    }

    const executedContent = this.generateExecutedBaaContent(baa, org.name, signerName, signerTitle)
    const executedPdfHash = generateSha256(executedContent)

    // For now, store path as a placeholder - in production this would be S3
    // [PLACEHOLDER] Implement actual PDF generation and S3 storage
    const executedPdfPath = `baa/${baa.organizationId}/${baa.id}/executed.pdf`

    const signatureData: VendorSignatureData = {
      vendorSignerUserId: superadminUserId,
      vendorSignerName: signerName,
      vendorSignerTitle: signerTitle
    }

    const updated = await baaAgreementRepository.recordVendorSignature(
      baa.id,
      signatureData,
      executedPdfHash,
      executedPdfPath
    )

    if (!updated) {
      throw new Error('Failed to record countersignature')
    }

    return updated
  }

  /**
   * Generate the BAA template with organization info filled in (for preview)
   */
  async generateBaaPreview(organizationId: string): Promise<string> {
    const org = await organizationRepository.findById(organizationId)
    if (!org) {
      throw new Error('Organization not found')
    }

    return BAA_TEMPLATE_TEXT
      .replace(/\{\{ORGANIZATION_NAME\}\}/g, org.name)
      .replace(/\{\{ORGANIZATION_ADDRESS\}\}/g, '[To be provided by organization]')
      .replace(/\{\{ORG_SIGNER_NAME\}\}/g, '________________________')
      .replace(/\{\{ORG_SIGNER_TITLE\}\}/g, '________________________')
      .replace(/\{\{ORG_SIGNED_DATE\}\}/g, '________________________')
      .replace(/\{\{ORG_SIGNER_EMAIL\}\}/g, '________________________')
      .replace(/\{\{VENDOR_SIGNER_NAME\}\}/g, '________________________')
      .replace(/\{\{VENDOR_SIGNER_TITLE\}\}/g, '________________________')
      .replace(/\{\{VENDOR_SIGNED_DATE\}\}/g, '________________________')
  }

  /**
   * Generate the executed BAA content with all signatures
   */
  private generateExecutedBaaContent(
    baa: BaaAgreement,
    orgName: string,
    vendorSignerName: string,
    vendorSignerTitle: string
  ): string {
    return BAA_TEMPLATE_TEXT
      .replace(/\{\{ORGANIZATION_NAME\}\}/g, orgName)
      .replace(/\{\{ORGANIZATION_ADDRESS\}\}/g, '[On file]')
      .replace(/\{\{ORG_SIGNER_NAME\}\}/g, baa.orgSignerName || '')
      .replace(/\{\{ORG_SIGNER_TITLE\}\}/g, baa.orgSignerTitle || '')
      .replace(/\{\{ORG_SIGNED_DATE\}\}/g, baa.orgSignedAt?.toISOString().split('T')[0] || '')
      .replace(/\{\{ORG_SIGNER_EMAIL\}\}/g, baa.orgSignerEmail || '')
      .replace(/\{\{VENDOR_SIGNER_NAME\}\}/g, vendorSignerName)
      .replace(/\{\{VENDOR_SIGNER_TITLE\}\}/g, vendorSignerTitle)
      .replace(/\{\{VENDOR_SIGNED_DATE\}\}/g, new Date().toISOString().split('T')[0])
  }

  /**
   * Get the executed BAA content for download
   */
  async getExecutedBaaContent(baaId: string): Promise<{ content: string; filename: string }> {
    const baa = await baaAgreementRepository.findByIdWithOrg(baaId)
    if (!baa) {
      throw new Error('BAA agreement not found')
    }

    if (baa.status !== 'executed') {
      throw new Error('BAA has not been executed')
    }

    const content = this.generateExecutedBaaContent(
      baa,
      baa.organization.name,
      baa.vendorSignerName || '',
      baa.vendorSignerTitle || ''
    )

    const filename = `BAA-${baa.organization.subdomain}-${baa.orgSignedAt?.toISOString().split('T')[0]}.txt`

    return { content, filename }
  }

  /**
   * Check if an organization has an executed BAA
   */
  async hasExecutedBaa(organizationId: string): Promise<boolean> {
    return baaAgreementRepository.hasExecutedBaa(organizationId)
  }

  /**
   * Void a BAA (superadmin only)
   * @param baaId - The BAA ID to void
   * @param _reason - The reason for voiding (logged in audit trail by caller)
   */
  async voidBaa(baaId: string, _reason: string): Promise<BaaAgreement> {
    const baa = await baaAgreementRepository.findById(baaId)
    if (!baa) {
      throw new Error('BAA agreement not found')
    }

    if (baa.status === 'voided' || baa.status === 'superseded') {
      throw new Error('BAA is already voided or superseded')
    }

    const updated = await baaAgreementRepository.void(baaId)
    if (!updated) {
      throw new Error('Failed to void BAA')
    }

    // Note: Reason is logged in audit trail by the route handler
    return updated
  }

  /**
   * Get BAA statistics (superadmin dashboard)
   */
  async getStats() {
    return baaAgreementRepository.getStats()
  }
}

export const baaService = new BaaService()
