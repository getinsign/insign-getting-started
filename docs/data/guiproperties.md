# InSign GUI Properties Reference

Auto-generated from three sources:
1. **OpenAPI spec** - fetched from sandbox.test.getinsign.show/v3/api-docs (162 properties)
2. **Java enum** - InSignGUIConstants.java from insign-rest-api-nodep-3.73.1 (147 values)
3. **feature-descriptions.json** - explorer UI features (57 guiProperties)

Total unique keys: 176

### Only in OpenAPI spec (24)

- `aushaendigenForceNoPassword`
- `consultantRenameDocuments`
- `documentVisibilityAvailable`
- `documentVisibilityRegex`
- `externDelegateUserdecision`
- `guiActionOverrideTextfieldwarning`
- `guiShowHinweisExitNichtFertig`
- `inputRequiredPropertyEnabled`
- `internetExplorerRestriction`
- `pageOverlayDisableSignatures`
- `passwordTransmissionUserdecision`
- `passwordTransmissionUserdecisionAlternativemail_enabled`
- `passwordTransmissionUserdecisionDefault`
- `passwordTransmissionUserdecisionNopassword_enabled`
- `passwordTransmissionUserdecisionSms_enabled`
- `quicktipsResetDays`
- `sessionExternFormfillingUserdecision`
- `sessionExternUploadUserdecision`
- `settingsPlugintokenApiAvailable`
- `systemcheckIgnoreconnect`
- `transmissionUserdecisionGroup`
- `useradminPasswordExpirationDisplay`
- `vorgangsverwaltungPrivateProcessDefault`
- `vorgangsverwaltungPrivateProcessVisible`

### In feature-descriptions but NOT in Java enum (5)

- `externDeleteLastSignature` (also in OpenAPI)
- `externUserGuidance` (also in OpenAPI)
- `sessionExternAddformfieldUserdecision` (also in OpenAPI)
- `settingsNameValue` (NOT in OpenAPI either)
- `settingsRealLocationValue` (NOT in OpenAPI either)

---

## All Properties

### `aboutAvailable`

Sources: enum


### `aboutFavDefault`

Sources: enum


### `addDocFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `add.doc.fav.default`
- **OpenAPI description**: Is the action "Add document" favored?

### `addFormFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `add.form.fav.default`
- **OpenAPI description**: Is the action "Add form fields" favored?

### `addFotoFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `add.foto.fav.default`
- **OpenAPI description**: Is the action "Photograph document" favored?

### `addMarkAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `add.mark.available`
- **OpenAPI description**: Is the "Add Marker" action available?

### `addMarkFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `add.mark.fav.default`
- **OpenAPI description**: Is the "Add Marker" action favored?

### `addformfieldAllowAes`

Sources: OpenAPI | enum | features

- **globalProperty**: `addformfield.allowAes`
- **OpenAPI description**: Can signature fields be created that require handwriting? This is the default signature level for insign.
- **Label**: Allow AES sig fields
- **Type**: bool
- **Feature description**: Controls whether signature fields requiring handwriting (AES - Advanced Electronic Signature) can be created via the form editor. AES is the default signature level in inSign, where users draw their signature on the device screen or via a paired smartphone/tablet. When enabled, the form editor toolbar includes the option to place AES signature fields on the document. These fields require the signer to provide a handwritten signature input. Default: true. This is the most common signature type and should remain enabled unless the workflow explicitly requires only text-based (SES) or qualified (QES) signatures.

### `addformfieldAllowAesSms`

Sources: OpenAPI | enum | features

- **globalProperty**: `addformfield.allowAesSms`
- **OpenAPI description**: Can signature fields be created that only require text input (mobile number verification involved)? In those fields the user can sign a document by only putting in his name.
- **Label**: Allow AES-SMS sig fields
- **Type**: bool
- **Feature description**: Controls whether signature fields with mobile number verification (AES-SMS) can be created via the form editor. AES-SMS combines a handwritten signature with SMS-based two-factor authentication: after signing, the user receives an SMS code that must be entered to confirm the signature. This provides a higher level of identity assurance than standard AES. When enabled, the form editor includes the AES-SMS signature field option. The signer's mobile number must be provided either via the API (signConfig) or entered by the signer during the process.

### `addformfieldAllowEveryOption`

Sources: OpenAPI | enum | features

- **globalProperty**: `addformfield.allow.every.option`
- **OpenAPI description**: Is the Formeditor for every editable document available and always shows every option? NOTE: If allowformediting is set to false, the editor won't be accessible.
- **Label**: Form editor all options
- **Type**: bool
- **Feature description**: When enabled, the form editor is available for every editable document and always shows every available option including all signature field types (AES, SES, AES-SMS, QES), text fields, checkboxes, and image annotations. Without this flag, the form editor may only show a subset of options based on other individual addformfield.* properties. IMPORTANT: If allowFormEditing is set to false on the document level, the form editor will not be accessible regardless of this setting. Default: false. This is a convenience flag that effectively enables all form editor capabilities at once, useful for administrator or power-user scenarios where full document editing control is desired.

### `addformfieldAllowQes`

Sources: OpenAPI | enum | features

- **globalProperty**: `addformfield.allowQes`
- **OpenAPI description**: Can signature fields be created that require a qualified signature? The user needs the role INSIGN_USER_QES in addition to this property.
- **Label**: Allow QES sig fields
- **Type**: bool
- **Feature description**: Controls whether qualified electronic signature (QES) fields can be created via the form editor. QES is the highest signature level, legally equivalent to a handwritten signature under eIDAS regulation. Creating QES fields requires the user to have the INSIGN_USER_QES role assigned. The QES process typically involves identity verification and a certificate-based signing ceremony. When enabled, the form editor toolbar shows the QES signature field option. This should only be enabled for users and workflows that require the highest level of legal assurance and where the QES infrastructure is properly configured.

### `addformfieldAllowSes`

Sources: OpenAPI | enum | features

- **globalProperty**: `addformfield.allowSes`
- **OpenAPI description**: Can signature fields be created that only require text input? In those fields the user can sign a document by only putting in his name.
- **Label**: Allow SES sig fields
- **Type**: bool
- **Feature description**: Controls whether signature fields requiring only text input (SES - Simple Electronic Signature) can be created via the form editor. SES fields allow a user to sign a document by simply entering their name as text, without handwriting input. This is the simplest signature level and is suitable for low-risk documents or internal acknowledgements. When enabled, the form editor shows the option to place SES signature fields. Default depends on server configuration. SES signatures do not carry the same legal weight as AES or QES signatures in most jurisdictions.

### `addformfieldAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `addformfield.available`
- **OpenAPI description**: Is the "Add form fields" mode available? true=automatic, false=not available?
- **Label**: Add form fields
- **Type**: bool
- **Feature description**: Controls whether the 'Add form fields' mode is available in the PDF editor. When set to true, the mode is activated automatically, allowing users to add text fields, checkboxes, signature fields, and other form elements directly onto the PDF document. Default: true. When set to false, users cannot add new form fields and can only interact with pre-existing fields in the document template. This is primarily a consultant/creator feature for building signing templates. The form fields added through this mode become interactive elements that signers can fill in during the signing process.

### `addformfieldFoto`

Sources: OpenAPI | enum | features

- **globalProperty**: `addformfield.foto`
- **OpenAPI description**: Can the user place image annotations via the formeditor?
- **Label**: Allow image annotations
- **Type**: bool
- **Feature description**: Controls whether the user can place image/photo annotations on documents via the form editor. When enabled, users can upload or capture images (such as photos of ID documents, stamps, or other visual elements) and place them as annotations on specific locations in the PDF. This is commonly used for attaching identity verification photos, company stamps, or other visual evidence to the signed document. The image annotations are embedded into the PDF during finalization. Default depends on server configuration.

### `archivePagesize`

Sources: enum

- **Javadoc**: How many results are shown on each page in UI's archive modal. type:integer default:200

### `aushaendigenAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `aushaendigen.available`
- **OpenAPI description**: Is the "Deliver documents" action available?
- **Label**: Handout available
- **Type**: bool
- **Feature description**: Controls whether the 'Deliver documents' / 'Hand over documents' action is available in the editor. Default: true. This feature allows the consultant to hand over signed documents to the customer during or after the signing session via various delivery methods including email, download, or physical media. This is the master toggle for document handout functionality. Related properties aushaendigen.mail and aushaendigen.mustberead.available control specific aspects of the handout process. Works together with aushaendigenPflicht (session.aushaendigenpflicht) which can make document handout mandatory before process completion.

### `aushaendigenDialogEditable`

Sources: OpenAPI | enum

- **globalProperty**: `aushaendigen.dialog.editable`
- **OpenAPI description**: Should the displayed dialog when handing out documents or completing a process have editable input fields?

### `aushaendigenFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `aushaendigen.fav.default`
- **OpenAPI description**: Is the action "Hand over documents" favoured?

### `aushaendigenFile`

Sources: OpenAPI | enum

- **globalProperty**: `aushaendigen.file`
- **OpenAPI description**: Is the "Deliver documents by data carrier" action available?

### `aushaendigenForceNoPassword`

Sources: OpenAPI

- **globalProperty**: `aushaendigen.force.NoPassword`
- **OpenAPI description**: This will override the password transmission of a handout user and always set it to no password. This way the documents will not get password protected.

### `aushaendigenMail`

Sources: OpenAPI | enum | features

- **globalProperty**: `aushaendigen.mail`
- **OpenAPI description**: Is the "Deliver documents by e-mail" action available?
- **Label**: Handout via email
- **Type**: bool
- **Feature description**: Controls whether the 'Deliver documents by email' action is available as a handout method. Default: true. When enabled, the consultant can send signed documents to the customer via email during the document handout step. The email delivery uses the configured sender address (senderEmail) and email templates. Works in conjunction with aushaendigen.available as the parent toggle. For download-link-based delivery instead of attachments, see document.email.download. The email content and subject can be customized through the email customization properties. Requires proper mail server configuration on the inSign instance.

### `aushaendigenMustbereadAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `aushaendigen.mustberead.available`
- **OpenAPI description**: Is the action "Hand over mandatory documents" available?
- **Label**: Must-read available
- **Type**: bool
- **Feature description**: Controls whether the 'Hand over mandatory documents' action is available. When enabled, designated documents must be read and explicitly confirmed by the recipient before the signing process can proceed. Default: false. This implements a read-and-confirm workflow where the user must scroll through or otherwise acknowledge mandatory documents prior to signing. Useful for regulatory compliance scenarios where proof of document review is legally required, such as terms and conditions, risk disclosures, or privacy policies. The documents marked as must-read are tracked separately from standard handout documents.

### `aushaendigenMustbereadFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `aushaendigen.mustberead.fav.default`
- **OpenAPI description**: Is the action "Hand over mandatory documents" favoured?

### `aushaendigenMustbereadIgnoreSignature`

Sources: OpenAPI | enum

- **globalProperty**: `aushaendigen.mustberead.ignore.signature`
- **OpenAPI description**: Once a signature is done in a document the mustberead-status will not reset, even if other signatures are added

### `aushaendigenPaper`

Sources: OpenAPI | enum

- **globalProperty**: `aushaendigen.paper`
- **OpenAPI description**: Is the "Deliver documents on paper" action available?

### `aushaendigenSms`

Sources: OpenAPI | enum

- **globalProperty**: `aushaendigen.sms`
- **OpenAPI description**: Is the "Deliver documents by SMS" action available? This option is only allowed if            sendtan.sms=true. For SMS messages the mode document.email.download=true is always used, because SMS cannot            contain attachments. If there is an obligation to confirm the delivery (flag handset obligation to confirm            at the interface), the mode handset.confirm.mode=download is always used for sending SMS messages.

### `batchSignatureAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `batch.signature.available`
- **OpenAPI description**: Should it be possible to sign multiple processes at once in the Standalone View?
- **Label**: Batch signature
- **Type**: bool
- **Feature description**: Controls whether batch signing of multiple processes at once is available in the Standalone View. Default: false, Recommended: true. When enabled, users can select multiple signing sessions and apply their signature to all of them in a single operation, dramatically improving efficiency for high-volume signing scenarios. This is particularly useful for consultants who need to process many similar documents. The batch signing feature works in the session list/gallery view. See also allowBatchSignature, which controls batch signing permission at the individual session level and can override this global setting.

### `burgerAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `burger.available`
- **OpenAPI description**: Is the "More Functions" dropdown in the sidebar for non favorite actions available? In mobile view the burger will always be available but only contain favorite actions if this is disabled.
- **Label**: More-menu
- **Type**: bool
- **Feature description**: Controls the visibility of the 'More Functions' dropdown menu (burger/hamburger menu) in the sidebar. This menu contains non-favorite actions that are available but not pinned to the main toolbar. Default: true. In mobile view, the burger menu is always available but will only show favorite actions if this property is set to false. The burger menu text for the exit action can be customized via burger.exit. Actions appear in the burger menu based on their availability properties and favorite status, providing a clean toolbar while keeping secondary functions accessible.

### `changeOrderDocumentAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `change.order.document.available`
- **OpenAPI description**: Allows to change the order for manually added documents.
- **Label**: Reorder documents
- **Type**: bool
- **Feature description**: Controls whether the user can change the order of manually added documents within a signing session. Default: false. When enabled, documents that were manually uploaded or added to the session can be reordered via drag-and-drop or order controls in the document list. This does not affect the order of template-based documents that are part of the original process definition. Useful in scenarios where multiple supplementary documents are added during a session and their presentation order matters for the signing workflow or final document package assembly.

### `changeSessionNameOnFirstUpload`

Sources: OpenAPI | enum

- **globalProperty**: `change.session.name.on.first.upload`
- **OpenAPI description**: If set to true then the session name would be changed with the first upload name

### `consultantRenameDocuments`

Sources: OpenAPI

- **globalProperty**: `consultant.rename.documents`
- **OpenAPI description**: Is the Consultant allowed to rename documents? Not possible for sessions via API.

### `customerFocusSigField`

Sources: OpenAPI | enum

- **globalProperty**: `customerFocusSigField`
- **OpenAPI description**: Navigates to first signature field for USER customer

### `deleteSignAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `delete.sign.available`
- **OpenAPI description**: Is the action "Delete signature" available?
- **Label**: Delete signature
- **Type**: bool
- **Feature description**: Controls whether placed signatures can be deleted by the user in the editor. Default: false. When enabled, users can remove a signature they have already placed on the document, allowing them to re-sign if they made a mistake. This applies to the internal/consultant view. For external users, a separate property extern.deleteLastSignature controls deletion capability, limited to the most recently placed signature only. Enabling this provides flexibility but may conflict with compliance requirements where signatures should be irrevocable once placed. Consider your workflow requirements carefully before enabling.

### `deleteSignFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `delete.sign.fav.default`
- **OpenAPI description**: Is the action "Delete signature" favored?

### `documentVisibilityAvailable`

Sources: OpenAPI

- **globalProperty**: `document.visibility.available`
- **OpenAPI description**: Is the process owner allowed to set the visibility of documents? If this feature is enabled, setting visibilityRuleRegexpList via API per document is not allowed.

### `documentVisibilityRegex`

Sources: OpenAPI

- **globalProperty**: `document.visibility.regex`
- **OpenAPI description**: Default visibility rules based on pairs {docregex},{recipientregex} separated by semicolon.            Only relevant if document.visibility.available is true.            Documents whose display name matches a {docregex} will only be visible to signatories matching {recipientregex}.            However, signatories can always see the documents they are assigned to.            Documents that do not match a {docregex} will be visible to all recipients.            Example: invisible.*,onlyme@example.org;.*partvisibile.*,.*@example.org;noone.*,

### `dualscreenFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `dualscreen.fav.default`
- **OpenAPI description**: Is the action "Dualscreen" favored?

### `dualscreenGuiAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `dualscreen.gui.available`
- **OpenAPI description**: Is the action "Dualscreen" available? THIS Property is unfinished. Don't use it!
- **Label**: Dual screen (experimental)
- **Type**: bool
- **Feature description**: Controls whether dualscreen mode is available in the editor interface. Default: false. WARNING: This property is unfinished and should NOT be used in production environments. When enabled, it activates an experimental dualscreen layout intended for setups where two displays are used simultaneously - for example, one screen for the consultant and another facing the customer. The feature is incomplete and may exhibit unexpected behavior, rendering issues, or missing functionality. Do not enable this in customer-facing deployments. It remains in the configuration schema for internal development and testing purposes only.

### `exitAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `exit.available`
- **OpenAPI description**: Is the Close action available?
- **Label**: Exit button
- **Type**: bool
- **Feature description**: Controls whether the Close/Exit action is available in the PDF editor toolbar. When enabled, users can close the current signing session and return to the previous view or callback URL. Default: false, Recommended: true. In mobile view, the exit action is always available regardless of this setting. Often used together with extern.exit.enabled for external users. If a callbackurl is configured, the exit action redirects the user to that URL upon closing. This property affects the sidebar action list and the burger menu favorites.

### `exitFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `exit.fav.default`
- **OpenAPI description**: Is the "[Editor] Close" action favored?

### `exitResetSignature`

Sources: OpenAPI | enum

- **globalProperty**: `exit.reset.signature`
- **OpenAPI description**: Should signatures be reset, when exit is used?

### `externAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `extern.available`
- **OpenAPI description**: Is the action "Have the process processed externally" available?
- **Label**: External signing
- **Type**: bool
- **Feature description**: Controls whether the 'Have the process processed externally' action is available in the editor. Default: true. When enabled, the consultant can send the signing process to external customers for remote signing via email invitation. This is the master toggle for all external signing functionality. External signers receive an email with a link to access the documents in their browser without needing an inSign account or app. Related properties like extern.user.guidance, extern.delegate.available, and extern.reject.available control specific aspects of the external signing experience and available actions for external users.

### `externDelegateAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `extern.delegate.available`
- **OpenAPI description**: Is the action "Delegate" available for a customer? With the delegate Action a customer can redirect the process to another person.
- **Label**: Delegate
- **Type**: bool
- **Feature description**: Controls whether the 'Delegate' action is available for external customers. Default: false, Recommended: true. When enabled, an external signer can redirect the signing process to another person by entering their email address. The original recipient's access is revoked and a new signing invitation is sent to the delegate. This is useful when the initial recipient is not the correct signer or needs someone else to review and sign the documents. The delegation creates a new external signing session for the delegate while maintaining the complete audit trail of the delegation chain.

### `externDelegateUserdecision`

Sources: OpenAPI

- **globalProperty**: `extern.delegate.userdecision`
- **OpenAPI description**: Is the consultant allowed to activate / deactivate the delegation function for external users. This overwrites extern.delegate.available

### `externDeleteLastSignature`

Sources: OpenAPI | features

- **globalProperty**: `extern.deleteLastSignature`
- **OpenAPI description**: Extern-User has the abilty to delete his last signature
- **Label**: Delete last signature
- **Type**: bool
- **Feature description**: Controls whether an external user can delete their most recently placed signature. Default: false. Unlike delete.sign.available for internal users, this restricts deletion to only the last signature placed, preventing external users from removing earlier signatures in the sequence. This provides a limited undo capability for external signers who make mistakes on their most recent signature without compromising the integrity of previously placed signatures. When enabled, a delete/undo button appears after the external user places a signature, remaining available until they navigate away or place another signature.

### `externExitEnabled`

Sources: OpenAPI | enum | features

- **globalProperty**: `extern.exit.enabled`
- **OpenAPI description**: Is the "Close" action also possible for external users? If yes, make sure to provide a proper callbackurl for the external users.            Requires "exit.available" and "exit.fav.default" to be enabled.
- **Label**: Exit for extern
- **Type**: bool
- **Feature description**: Controls whether the 'Close' action is available for external users after they complete their signing process. Default: false, Recommended: true. When enabled, external users can close the signing view and are redirected to the configured callbackurl. Important: a proper callbackurl should be provided when enabling this, otherwise the user may see an error or blank page. Requires exit.available and exit.fav.default to also be configured. This provides a clean end-to-user journey for external signers, redirecting them back to the originating application or a thank-you page after signing.

### `externFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `extern.fav.default`
- **OpenAPI description**: Is the action "Have process processed externally" favored?

### `externMultiAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `extern.multi.available`
- **OpenAPI description**: Can a process be output from the GUI to multiple customers?
- **Label**: External multi
- **Type**: bool
- **Feature description**: Controls whether a signing process can be sent from the GUI to multiple external customers simultaneously. Default: false, Recommended: true. When enabled, the consultant can add multiple external signers to a single process, each receiving their own signing invitation. This enables multi-party contract signing scenarios. Related properties include extern.multi.showOtherSignaturefields (controls visibility of other signers' fields) and extern.multi.order.default (controls sequential vs. parallel signing order). Each external signer receives a separate email invitation and has their own independent signing session with their designated signature fields.

### `externMultiOrderDefault`

Sources: OpenAPI | enum | features

- **globalProperty**: `extern.multi.order.default`
- **OpenAPI description**: If extern.multi.available = true, then the order should be specified. Default is false (no            order).            Note: If the QES button is favoured in the session, then through online editing the signatures will be availed to each extern user in order.            Hence, extern.multi.available = true is always considered and the property value will be ignored.
- **Label**: Signing order
- **Type**: bool
- **Feature description**: Specifies the default signing order when extern.multi.available is enabled for multi-party external signing. Default: false (no enforced order, parallel signing). When set to true, signers must complete their signatures in a defined sequential order. Note: if the QES (Qualified Electronic Signature) button is favored, online editing forces sequential signing order regardless of this setting's value. This property sets the default behavior which can potentially be overridden per session. Sequential signing is important for workflows where later signers need to see earlier signatures before signing themselves.

### `externMultiShowOtherSignaturefields`

Sources: OpenAPI | enum | features

- **globalProperty**: `extern.multi.showOtherSignaturefields`
- **OpenAPI description**: Display signature fields of other user while using extern. If false pdf.signature.aes.includepersonaldata will be ignored for extern signatures and no personal data is included. Can be configured on a per user basis with settings.extern.multi.showOtherSignaturefields.available
- **Label**: Show other sig fields
- **Type**: bool
- **Feature description**: Controls whether signature fields belonging to other signers are visible during multi-party external signing. Default: true. When set to false, each external signer only sees their own designated signature fields, and the property pdf.signature.aes.includepersonaldata is ignored for extern signatures, meaning no personal data is included in other signers' visible fields. Can be configured per user via settings.extern.multi.showOtherSignaturefields.available. Hiding other signers' fields improves privacy in sensitive multi-party scenarios but reduces the signer's context about where other parties will sign on the document.

### `externPageOverlayAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `extern.page.overlay.available`
- **OpenAPI description**: Is the "No release" action for the extern user available?
- **Label**: Page overlay for extern
- **Type**: bool
- **Feature description**: Controls whether the 'No release' overlay action is available for external users. Default: false. When enabled, external users can stamp an overlay image on the document, typically used to indicate that the document is not yet released or approved. This is the external counterpart to page.overlay.available, which provides the same functionality for the process creator/consultant. The overlay is rendered as an image placed at the center of the document page. Useful in review workflows where external parties need to mark documents as draft or pending before final signatures are placed.

### `externRejectAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `extern.reject.available`
- **OpenAPI description**: Should the signatory be able to reject a process?
- **Label**: Reject available
- **Type**: bool
- **Feature description**: Controls whether an external signatory can reject the entire signing process. Default: false, Recommended: true. When enabled, external users see a 'Reject' action that allows them to decline signing and optionally provide a rejection reason. The rejection notification is sent back to the process creator/consultant. This is important for contract workflows where the external party must have the legal right to refuse. The process status changes to 'rejected' and the consultant is informed via notification. Enabling this provides a formal rejection mechanism rather than having users simply abandon the session.

### `externSaveDocAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `extern.save.doc.available`
- **OpenAPI description**: Is the action "Save document" available for the customer?
- **Label**: Save doc for extern
- **Type**: bool
- **Feature description**: Controls whether the 'Save document' action is available for external customers (not the consultant). Default: false, Recommended: true. When enabled, external signers can download or save a copy of the document during their signing session. This is the external counterpart to save.doc.available, which controls the same functionality for internal/consultant users. Enabling this gives external signers the ability to retain a copy of the documents they are signing, which is often expected or legally required. The saved document includes all signatures and form data entered up to that point.

### `externShowAssigned`

Sources: OpenAPI | enum

- **globalProperty**: `extern.show.assigned`
- **OpenAPI description**: Should users see processes that were assigned to them regardless extern.use.domain or security.ad.domain? Notice: This will lead to users getting a passwordmail although they are available to access the process directly from the UI.

### `externUseDomain`

Sources: OpenAPI | enum

- **globalProperty**: `extern.use.domain`
- **OpenAPI description**: Should users who are part of the extern.domain or are present in the Useradmin see their external processes in the process manager?  Otherwise, fallback to security.ad.domain. If this property and document.email.download are true, handovers to mails with an associated user account will require their user account to download documents.

### `externUserGuidance`

Sources: OpenAPI | features

- **globalProperty**: `extern.user.guidance`
- **OpenAPI description**: Should the external user be guided through the signing process? Requires 'gui.afterSignOpenNextSignatureField=false'
- **Label**: User guidance
- **Type**: bool
- **Feature description**: Enables step-by-step guidance for external users through the signing process using visual arrows, highlights, and sequential field navigation. Default: true. When active, external signers are guided from one signature field to the next with clear visual indicators showing where to sign. Important constraint: requires gui.afterSignOpenNextSignatureField to be set to false, as automatic field navigation conflicts with the guided workflow. This feature significantly improves completion rates for external signers unfamiliar with the interface. The guidance system highlights the current field, dims completed fields, and provides clear directional cues.

### `faviconIco`

Sources: enum

- **Javadoc**: Alternate Favicon to be used. Recommended sizes to include: 32x32, 48x48, 196x196. If this is changed, then the other favicon variants should also be updated. Tip: Use a generator the create the relevant files (e.g. <a href="https://realfavicongenerator.net/">https://realfavicongenerator.net/</a>) type:FILEREFERENCE default:classpath:/favicons/favicon.ico

### `faviconPng`

Sources: enum

- **Javadoc**: Alternate Favicon to be used for Apple devices. Recommended size: 180x180. If this is changed, then the other favicon variants should also be updated. type:FILEREFERENCE default:classpath:/favicons/favicon.png

### `faviconSvg`

Sources: enum

- **Javadoc**: Alternate Favicon in SVG format. If this is changed, then the other favicon variants should also be updated. type:FILEREFERENCE default:classpath:/favicons/favicon.svg

### `finishAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `finish.available`
- **OpenAPI description**: Is the "Complete process" action available?
- **Label**: Finish button
- **Type**: bool
- **Feature description**: Controls whether the 'Complete process' action is available in the editor. This action allows the consultant to finalize the signing transaction, triggering document processing, archival, and any configured post-completion workflows such as email delivery or webhook callbacks. Default: true. This must remain enabled for any process to be completed; disabling it effectively locks the session in an open state. Often paired with finish.mail and finish.file to control how documents are delivered upon completion. The finish action triggers the final confirmation dialog unless gui.fertigbutton.skipModalDialog is enabled.

### `finishFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `finish.fav.default`
- **OpenAPI description**: Is the action "Complete process" favored?

### `finishFile`

Sources: OpenAPI | enum | features

- **globalProperty**: `finish.file`
- **OpenAPI description**: Is the action "Deliver by data carrier at completion of transaction" available?
- **Label**: File on finish
- **Type**: bool
- **Feature description**: Controls whether the 'Deliver by data carrier at completion of transaction' action is available. Default: true. When enabled, upon completing the signing process, users are offered the option to download or save the finalized documents to a local data carrier (USB drive, local storage, etc.). This provides an offline delivery mechanism complementing finish.mail for email delivery. Both options can be enabled simultaneously, giving users flexibility in how they receive completed documents. Particularly useful in environments with restricted email access or when physical document copies are required for archival purposes.

### `finishMail`

Sources: OpenAPI | enum | features

- **globalProperty**: `finish.mail`
- **OpenAPI description**: Is the action "Hand over by e-mail on completion of transaction" available?
- **Label**: Email on finish
- **Type**: bool
- **Feature description**: Controls whether the 'Hand over by email on completion of transaction' action is available. Default: true. When enabled, upon completing the signing process, the system can automatically send the finalized documents to recipients via email. This differs from aushaendigen.mail in that it triggers specifically at transaction completion rather than during the session. The email delivery happens as part of the finish workflow and uses the configured email templates and sender address. Works alongside finish.file which controls delivery via data carrier. Both can be enabled simultaneously to offer multiple delivery options.

### `finishPaper`

Sources: OpenAPI | enum

- **globalProperty**: `finish.paper`
- **OpenAPI description**: Is the "Deliver by paper at transaction close" action available?

### `formfieldSizeAes`

Sources: OpenAPI | enum

- **globalProperty**: `formfield.size.aes`
- **OpenAPI description**: The default and minimal sizes for AES (handwriting) signature fields when editing via the form editor.            Format: defaultWidth,defaultHeight,minWidth,minHeight

### `formfieldSizeAessms`

Sources: OpenAPI | enum

- **globalProperty**: `formfield.size.aessms`
- **OpenAPI description**: The default and minimal sizes for AESSMS (text input with mobile number verification) signature fields when editing via the form editor.            Format: defaultWidth,defaultHeight,minWidth,minHeight

### `formfieldSizeQes`

Sources: enum

- **Javadoc**: The default and minimal sizes for QES signature fields (except IDNow) when editing via the form editor. Format: defaultWidth,defaultHeight,minWidth,minHeight type:string default:240,80,90,30

### `formfieldSizeQesIdnow`

Sources: enum

- **Javadoc**: The default and minimal sizes for QES IDNow signature fields when editing via the form editor. Format: defaultWidth,defaultHeight,minWidth,minHeight type:string default:300,42,300,42

### `formfieldSizeSes`

Sources: OpenAPI | enum

- **globalProperty**: `formfield.size.ses`
- **OpenAPI description**: The default and minimal sizes for SES (text input) signature fields when editing via the form editor.            Format: defaultWidth,defaultHeight,minWidth,minHeight

### `guiActionFinishIgnoresignstatus`

Sources: OpenAPI | enum

- **globalProperty**: `gui.action.finish.ignoresignstatus`
- **OpenAPI description**: If you click on "Finish process", do ignore the message that not all signature fields have been            signed yet.

### `guiActionOverrideTextfieldwarning`

Sources: OpenAPI

- **globalProperty**: `gui.action.override.textfieldwarning`
- **OpenAPI description**: Can the user sign a document if there are still unfilled text fields?

### `guiAfterSignOpenNextSignatureField`

Sources: OpenAPI | enum | features

- **globalProperty**: `gui.afterSignOpenNextSignatureField`
- **OpenAPI description**: When clicking on "next signature" in the PDF editor, switch to signature mode immediately and open            the next signature field immediately after the signature has been completed.
- **Label**: Auto-open next field
- **Type**: bool
- **Feature description**: After a user completes signing a field, the editor automatically switches back to signature mode and opens the next unsigned signature field for immediate signing. Default: false. This creates a streamlined, rapid signing flow ideal for documents with many signature fields. Important interaction: this property must be set to false for extern.user.guidance to function correctly, as the step-by-step guidance system conflicts with automatic field navigation. When enabled, it effectively chains signature actions together, reducing the number of clicks needed to complete a multi-signature document.

### `guiAllowChangeSmsEmail`

Sources: OpenAPI | enum | features

- **globalProperty**: `gui.allow.change.smsEmail`
- **OpenAPI description**: Is the user allowed to change phone numbers and email addresses that are supplied via API by using signConfig.applosKundePerEmailEmpfaenger or signConfig.applosKundePerSmsEmpfaenger?            Relevant for customer signature pairing by sms or e-mail.
- **Label**: Allow change SMS/email
- **Type**: bool
- **Feature description**: Controls whether the external signer is allowed to change the phone number or email address that was pre-configured via the API through signConfig.applosKundePerEmailEmpfaenger or signConfig.applosKundePerSmsEmpfaenger. When enabled, the pairing dialog shows editable fields allowing the signer to modify the contact details. When disabled, the pre-configured values are locked and the signer must use the exact phone number or email address provided by the API caller. Disabling this is recommended for security-sensitive workflows where the signer's identity is verified through the provided contact channel.

### `guiAutoRetrieveProcess`

Sources: OpenAPI | enum

- **globalProperty**: `gui.auto.retrieveProcess`
- **OpenAPI description**: Should the "Set expiration date" option be available in the request signature modal? Requires the "extern.autofinish" cronjob to be enabled

### `guiDisableMonitorChoice`

Sources: OpenAPI | enum

- **globalProperty**: `gui.disableMonitorChoice`
- **OpenAPI description**: Should the manual screen selection be suppressed?

### `guiEmbeddedHotspotdisabled`

Sources: OpenAPI | enum

- **globalProperty**: `gui.embedded.hotspotdisabled`
- **OpenAPI description**: Disable all features for hotspot (embeddedMode only)

### `guiFertigbuttonModalDialogExternSkipSendMail`

Sources: OpenAPI | enum | features

- **globalProperty**: `gui.fertigbutton.ModalDialogExtern.skipSendMail`
- **OpenAPI description**: Remove the Option "send by mail" from the final dialog for customers?
- **Label**: Hide send-mail in extern dialog
- **Type**: bool
- **Feature description**: Removes the 'send by mail' option from the final completion dialog shown to external customers. Default: false. When the external signing completion dialog is displayed (i.e., gui.fertigbutton.skipModalDialogExtern is false), this property hides the email delivery option from that dialog. Useful when document delivery should be controlled exclusively by the consultant or backend system rather than allowing external users to trigger email sends. This provides tighter control over document distribution and prevents external signers from sending copies to arbitrary email addresses during the completion step.

### `guiFertigbuttonSkipModalDialog`

Sources: OpenAPI | enum | features

- **globalProperty**: `gui.fertigbutton.skipModalDialog`
- **OpenAPI description**: If you click on "Done", no modal dialog is displayed.
- **Label**: Skip finish dialog
- **Type**: bool
- **Feature description**: When the user clicks the 'Done'/'Fertig' button to complete the signing process, this property controls whether the modal confirmation dialog is skipped. Default: false. When enabled, clicking Done proceeds directly to process completion without showing an intermediate confirmation screen. This speeds up the workflow but removes the safety net of a final review step. There is a separate extern variant (gui.fertigbutton.skipModalDialogExtern) that controls this behavior specifically for external signers. Consider the trade-off between speed and user confirmation before enabling in production environments.

### `guiFertigbuttonSkipModalDialogExtern`

Sources: OpenAPI | enum | features

- **globalProperty**: `gui.fertigbutton.skipModalDialogExtern`
- **OpenAPI description**: If you click on "Done" in external mode, no modal dialog is displayed.
- **Label**: Skip finish dialog (extern)
- **Type**: bool
- **Feature description**: Same functionality as gui.fertigbutton.skipModalDialog but applied specifically to external signing mode. When enabled, external users clicking the 'Done' button proceed directly without seeing a modal confirmation dialog. Default: false. This streamlines the external signing experience by removing the extra confirmation step. Particularly useful when extern.user.guidance is active, as the guided flow already provides clear step-by-step instructions, making the confirmation dialog redundant. Can be used independently of the internal variant, allowing different behavior for consultants versus external signers in the completion workflow.

### `guiHintAllsigned`

Sources: OpenAPI | enum | features

- **globalProperty**: `gui.hint.allsigned`
- **OpenAPI description**: Show hint popup for saving after last signature?
- **Label**: All-signed hint
- **Type**: bool
- **Feature description**: Controls whether a hint popup is displayed after the last signature has been placed, prompting the user to save or complete the process. Default: false, Recommended: true. When enabled, once all signature fields have been signed, a notification appears guiding the user toward the completion step. This improves the user experience by clearly indicating that all required signatures are done. Related property gui.hint.allsigned.skipSaveDialog can be used to skip the save dialog and go straight to the final completion dialog. This visual feedback is particularly helpful for documents with many signature fields.

### `guiHintAllsignedSkipSaveDialog`

Sources: OpenAPI | enum

- **globalProperty**: `gui.hint.allsigned.skipSaveDialog`
- **OpenAPI description**: Don't show hint popup for saving after last signature and jump directly to final dialog instead?

### `guiLeavepagewarning`

Sources: OpenAPI | enum | features

- **globalProperty**: `gui.leavepagewarning`
- **OpenAPI description**: Show a warning in the browser when leaving the page?
- **Label**: Leave-page warning
- **Type**: bool
- **Feature description**: Controls whether a browser warning dialog is shown when the user attempts to navigate away from the signing page (triggered by the beforeunload event). Default: true. When enabled, the browser displays a confirmation dialog asking the user if they really want to leave the page, preventing accidental loss of unsigned documents or in-progress signing sessions. This is a standard browser behavior that protects against accidental navigation, page refresh, or tab/window closure. Disabling this allows users to leave without warning, which may be appropriate for embedded iframe scenarios where navigation is controlled by the parent application.

### `guiNoGPS`

Sources: OpenAPI | enum | features

- **globalProperty**: `gui.noGPS`
- **OpenAPI description**: Should the location of tablets/mobile devices NOT be queried in the browser?
- **Label**: Disable GPS
- **Type**: bool
- **Feature description**: Controls whether the geographic location of tablets and mobile devices should NOT be queried via the browser's geolocation API. Default: false (meaning GPS is queried by default). When set to true, the application will not request GPS/location permissions from the browser, avoiding the location permission popup on mobile devices and tablets. This is useful in environments where location tracking is unwanted due to privacy regulations or where GPS queries cause unwanted browser permission dialogs. The location data, when collected, can be used for audit trail purposes and signature metadata enrichment.

### `guiOnnextopentosign`

Sources: OpenAPI | enum | features

- **globalProperty**: `gui.onnextopentosign`
- **OpenAPI description**: When clicking on "next signature" or on the external guidance arrow in the PDF editor, immediately open the pairing dialog?
- **Label**: Auto-open pairing dialog
- **Type**: bool
- **Feature description**: Controls whether clicking 'next signature' or following the external user guidance arrow immediately opens the pairing/signing dialog instead of just scrolling to the signature field. When enabled, navigation to the next signature field automatically triggers the signing popup, reducing the number of clicks needed in the signing workflow. This streamlines the user experience especially for documents with many signature fields. When disabled (default), the user must click on the signature field after navigating to it. Works for both session owner and external signer navigation.

### `guiProgressEnabled`

Sources: OpenAPI | enum | features

- **globalProperty**: `gui.progress.enabled`
- **OpenAPI description**: Process manager: progress, number of signed signatures, document / transaction display? In            the case of clustering, nothing is displayed in process management.
- **Label**: Progress indicator
- **Type**: bool
- **Feature description**: Enables the process manager progress counter in the UI, showing the number of signed signatures relative to the total required, along with document and transaction display information. Default: false, Recommended: true. When enabled, users see a real-time progress indicator that updates as signatures are placed. In case of clustering (multi-server deployments), the progress display may not show. Related property gui.progress.optional adds a separate line showing optional signature fields. This feature significantly improves user orientation in complex documents with many signature fields by providing clear visual feedback on completion status.

### `guiProgressOptional`

Sources: OpenAPI | enum

- **globalProperty**: `gui.progress.optional`
- **OpenAPI description**: PDF Editor: Displays an additional line for optional signature fields - if available. Otherwise            only one counter is displayed if only mandatory fields are available.

### `guiSessionDisplaynameAndCustomerEditable`

Sources: OpenAPI | enum

- **globalProperty**: `gui.sessionDisplaynameAndCustomerEditable`
- **OpenAPI description**: Should the display name be editable in the editor and standalone view?

### `guiShowHinweisExitNichtFertig`

Sources: OpenAPI

- **globalProperty**: `gui.showHinweisExitNichtFertig`
- **OpenAPI description**: Show hint dialog when closing process, if process is not yet ready for completion, e.g. due to            missing signatures.

### `guiSignatureQualityscaleDouble`

Sources: enum


### `guiTemplateWeblinkAvailable`

Sources: enum

- **Javadoc**: Transaction management / Gallery: Allow the creation of "self-service" links, i.e. embeddable links to templates where users can start a process themselves.

### `guiUpdateThumbSignHint`

Sources: OpenAPI | enum

- **globalProperty**: `gui.updateThumbSignHint`
- **OpenAPI description**: Displays additional markers for signature fields in the thumb

### `guiVorgangsverwaltungenabled`

Sources: OpenAPI | enum | features

- **globalProperty**: `gui.vorgangsverwaltungenabled`
- **OpenAPI description**: Allow access to process management?
- **Label**: Session Manager
- **Type**: bool
- **Feature description**: Controls whether the Session Manager (Vorgangsverwaltung) is available in the editor. When enabled, users can access the session/process management view to see all their signing sessions, filter by status, and manage multiple transactions. Default: false. The Session Manager provides an overview of all sessions assigned to the current user, with options to open, delete, or continue sessions. Related properties include vorgangsverwaltung.delete.available, vorgangsverwaltung.action.available, and vorgangsverwaltung.pagesize for controlling specific features within the manager.

### `helpAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `help.available`
- **OpenAPI description**: Is the action "help" available?
- **Label**: Help button
- **Type**: bool
- **Feature description**: Controls whether the Help action is visible in the editor toolbar and burger menu. When enabled, users can access contextual help information about the signing interface, available tools, and signing workflow. Default: false. The help content is typically localized according to the session's locale setting. This action appears in the sidebar action list and can be included in the burger menu dropdown. Consider enabling alongside quicktips.enabled for a comprehensive user assistance experience, especially for first-time users or complex signing workflows with multiple document types.

### `helpFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `help.fav.default`
- **OpenAPI description**: Is the "Help" action favored?

### `helpUrl`

Sources: enum


### `hideApisessionsInVvw`

Sources: OpenAPI | enum

- **globalProperty**: `hide.apisessions.in.vvw`
- **OpenAPI description**: Should processes, which where created over the API, be hidden in the Process Management?

### `inputRequiredPropertyEnabled`

Sources: OpenAPI

- **globalProperty**: `input.required.property.enabled`
- **OpenAPI description**: This has no immediate effect but can be used for custom css styling. If set to true then input fields in the editor will have the html property required.

### `internetExplorerRestriction`

Sources: OpenAPI

- **globalProperty**: `internet.explorer.restriction`
- **OpenAPI description**: If this is enabled, the Internet Explorer browser will no longer be supported by inSign in order to prevent broken user interfaces. Default is unsupported.

### `keepmessagetokens`

Sources: OpenAPI | enum

- **globalProperty**: `keepmessagetokens`
- **OpenAPI description**: Show messagekeys instead of resolved messages to find the keys you want to customize.

### `navtoolbarAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `navtoolbar.available`
- **OpenAPI description**: Should the navigation toolbar be shown in the editor.
- **Label**: Nav toolbar
- **Type**: bool
- **Feature description**: Controls whether the navigation toolbar is displayed in the PDF editor. The navigation toolbar provides page-by-page navigation controls including previous/next page buttons and a page number indicator showing the current page relative to total pages. Default: false, Recommended: true. Enabling this property significantly improves the user experience for multi-page documents by giving users precise control over document navigation. Without it, users must scroll through the document manually. The toolbar integrates with the document viewer and updates in real-time as the user scrolls through pages.

### `nextMarkAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `next.mark.available`
- **OpenAPI description**: Is the Next Marker action available?

### `nextMarkFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `next.mark.fav.default`
- **OpenAPI description**: Is the "Next selection" action favored?

### `nextSignAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `next.sign.available`
- **OpenAPI description**: Is the "Next Signature" action available?
- **Label**: Next signature
- **Type**: bool
- **Feature description**: Controls whether the 'Next Signature' navigation button is available in the editor. When enabled, users can click this button to automatically scroll to and highlight the next unsigned signature field in the document. Default: true. This is especially useful for documents containing multiple signature fields spread across different pages. The navigation follows document order and skips already-signed fields. Works in conjunction with gui.afterSignOpenNextSignatureField, which automates this navigation after each signature is placed. Distinct from search.available, which specifically targets text-based signature fields only.

### `nextSignFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `next.sign.fav.default`
- **OpenAPI description**: Is the action "Next signature" favored?

### `offlineButtonAvailable`

Sources: enum

- **Javadoc**: Should the button or drop-down point in the process management be displayed in order to make processes available offline?  type:boolean default:false

### `pageOverlayAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `page.overlay.available`
- **OpenAPI description**: Is the "No release" action for the process creator available?
- **Label**: Page overlay
- **Type**: bool
- **Feature description**: Controls whether the 'No release' overlay action is available for the process creator/consultant. Default: false. When enabled, the consultant can stamp an overlay image onto the center of a document page, typically used to mark documents as 'not released', 'draft', or 'void'. This provides a visual safeguard against premature distribution of unsigned documents. The overlay image is rendered directly onto the PDF content. For external users, a separate property extern.page.overlay.available controls the same functionality. The overlay is a non-removable stamp once applied to the document.

### `pageOverlayDisableSignatures`

Sources: OpenAPI

- **globalProperty**: `page.overlay.disable.signatures`
- **OpenAPI description**: Should the signatures be disabled when the pdf overlay image is activated for a document.

### `pageOverlayFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `page.overlay.fav.default`
- **OpenAPI description**: Is the action "No release" for the process creator favored?

### `passwordTransmissionUserdecision`

Sources: OpenAPI

- **globalProperty**: `password.transmission.userdecision`
- **OpenAPI description**: Should the user be able to choose the way in which the password is sent? If no Option is active it will be treated as if all options are active. Will override extern.per.sms, sendtan.sms and sendtan.muendlich. mail.zip has to be true to prevent password protecting signed PDFs because this would invalidate the signatures. session.aushaendigenpflicht has to be set to false.

### `passwordTransmissionUserdecisionAlternativemail_enabled`

Sources: OpenAPI

- **globalProperty**: `password.transmission.userdecision.alternativemail_enabled`
- **OpenAPI description**: Should 'password via email' be an option given to the user? When the user selects this, the password will be sent via email.

### `passwordTransmissionUserdecisionDefault`

Sources: OpenAPI

- **globalProperty**: `password.transmission.userdecision.default`
- **OpenAPI description**: The default selection for the user decision dropdown

### `passwordTransmissionUserdecisionNopassword_enabled`

Sources: OpenAPI

- **globalProperty**: `password.transmission.userdecision.nopassword_enabled`
- **OpenAPI description**: Should 'no password' be an option given to the user? When the user selects this, a password will not have to be entered for the selected process.

### `passwordTransmissionUserdecisionSms_enabled`

Sources: OpenAPI

- **globalProperty**: `password.transmission.userdecision.sms_enabled`
- **OpenAPI description**: Should 'password via SMS' be an option given to the user? When the user selects this, the password will be sent via sms after the link is clicked.

### `pdfSaveAlert`

Sources: OpenAPI | enum

- **globalProperty**: `pdf.save.alert`
- **OpenAPI description**: If true show success toast after save.

### `quicktipsEnabled`

Sources: OpenAPI | enum | features

- **globalProperty**: `quicktips.enabled`
- **OpenAPI description**: Should Quick-Tips be displayed?
- **Label**: Quick-tips
- **Type**: bool
- **Feature description**: Controls whether Quick-Tips are displayed in the UI - small contextual help popups that appear at relevant interaction points to guide users. Default: false, Recommended: true. Quick-Tips provide inline assistance without requiring users to open a separate help section. Related properties include quicktips.tutorial.enabled, which controls a more comprehensive tutorial variant that walks new users through the entire interface, and quicktips.reset.days, which controls the automatic reset interval after which tips reappear. Quick-Tips are dismissed individually and their state is remembered per user session.

### `quicktipsResetDays`

Sources: OpenAPI

- **globalProperty**: `quicktips.reset.days`
- **OpenAPI description**: After how many days will Standard Quick-Tips that were disabled by clicking the 'X' be active again?            You can also enter whole minutes as decimal places, where 0.00347, for example, corresponds to 5 minutes.            Only relevant if quicktips.enabled=true. Not applicable for Tutorial Quick-Tips.

### `quicktipsTutorialEnabled`

Sources: OpenAPI | enum

- **globalProperty**: `quicktips.tutorial.enabled`
- **OpenAPI description**: Should Quick-Tips tutorial be displayed? Only relevant if quicktips.enabled=true

### `rejectAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `reject.available`
- **OpenAPI description**: This activates the "Reject" function. Attention: If a process is rejected, it will be irrevocably deleted.

### `rejectFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `reject.fav.default`
- **OpenAPI description**: Is the "Reject" function preferred?

### `restarchiveSettingsAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `restarchive.settings.available`
- **OpenAPI description**: Is the action "Archive Settings" available? Only relevant if restarchive.enabled=true

### `restarchiveSettingsFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `restarchive.settings.fav.default`
- **OpenAPI description**: Is the action "Archive Settings" favored? Only relevant if restarchive.enabled=true

### `saveAsTemplateAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `save.as.template.available`
- **OpenAPI description**: Is the action "Save as template" available?

### `saveAsTemplateFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `save.as.template.fav.default`
- **OpenAPI description**: Is the "Save as template" action favored?

### `saveDocAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `save.doc.available`
- **OpenAPI description**: Is the action "Save document" available for the consultant?
- **Label**: Save document
- **Type**: bool
- **Feature description**: Controls whether the 'Save document' action is available for the consultant (internal user) in the editor. Default: true. When enabled, the consultant can save the current state of the document during the signing session without completing the entire process. This is useful for long signing sessions or when the process needs to be paused and resumed later. This property applies only to the internal/consultant view. For external users, use extern.save.doc.available instead. The save action preserves all placed signatures, form field entries, and document modifications made during the session.

### `saveDocFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `save.doc.fav.default`
- **OpenAPI description**: Is the action "Save document" favored for the consultant?

### `searchAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `search.available`
- **OpenAPI description**: Is the action "Next signature text" available?
- **Label**: Search
- **Type**: bool
- **Feature description**: Controls whether the 'Next signature text' search action is available in the editor toolbar. When enabled, users can navigate to the next text-based signature field in the document by clicking the search action, streamlining the signing workflow for documents with multiple signature fields. Default: true. This is distinct from next.sign.available, which navigates to the next unsigned field of any type. The search function specifically targets text-based signature fields and is useful in documents where signatures are interspersed with form fields that should not be navigated to automatically.

### `searchFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `search.fav.default`
- **OpenAPI description**: Is the action "Next signature text" favored?

### `serialProcessAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `serial.process.available`
- **OpenAPI description**: This activates the "Serial process" function.

### `serialProcessFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `serial.process.fav.default`
- **OpenAPI description**: Is the "Serial process" function preferred?

### `sessionExternAddformfieldUserdecision`

Sources: OpenAPI | features

- **globalProperty**: `session.extern.addformfield.userdecision`
- **OpenAPI description**: Is the consultant allowed to activate / deactivate functionality to add formfields for external users. Only allows editing of textfields and checkboxes. addformfield.available must be true.
- **Label**: Extern form fields toggle
- **Type**: bool
- **Feature description**: Controls whether the consultant (session owner) can toggle form field editing capabilities on or off for external users on a per-session basis. When enabled, the session UI shows a toggle that lets the consultant decide whether the external signer should be able to add or edit form fields. This requires addformfield.available to be true as a prerequisite. Only allows editing of text fields and checkboxes for external users, not signature fields. Useful for workflows where some sessions need external form editing but others do not, giving the consultant control over this per interaction.

### `sessionExternFormfillingUserdecision`

Sources: OpenAPI

- **globalProperty**: `session.extern.formfilling.userdecision`
- **OpenAPI description**: Is the consultant allowed to activate / deactivate functionality to enable form filling for external users. This overwrites extern.edit.allowed

### `sessionExternUploadUserdecision`

Sources: OpenAPI

- **globalProperty**: `session.extern.upload.userdecision`
- **OpenAPI description**: Is the consultant allowed to activate / deactivate functionality to add documents for external users. This overwrites session.extern.upload.enabled and only works if upload.attachAsImage = false

### `settingsAuditreportAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.auditreport.available`
- **OpenAPI description**: Should the "Audit report" setting be available in the settings modal for gallery users?

### `settingsAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `settings.available`
- **OpenAPI description**: Is the "Settings" action available?
- **Label**: Settings
- **Type**: bool
- **Feature description**: Controls whether the Settings modal dialog is accessible from the editor toolbar. The settings modal allows users to configure personal preferences such as their name (settings.name.available), location (settings.realLocation.available), and timestamp display (settings.timestamp.available). Default: true. Disabling this hides the settings gear icon from the toolbar entirely. Individual setting options within the modal can be controlled independently via their respective properties. The settings modal is also where gallery users can manage their signature preferences and personal data used in AES signature metadata.

### `settingsCompanystampUploadAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.companystamp.upload.available`
- **OpenAPI description**: Should the "Companystamp upload" be available in the settings modal for gallery users?

### `settingsExaminerMailCommentAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.examiner.mail.comment.available`
- **OpenAPI description**: Should "Include release comment in emails" be available in the Settings to all gallery users? Can be            configured on a global level with examiner.mail.comment. For more details look at the description there.

### `settingsExternMultiShowOtherSignaturefieldsAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.extern.multi.showOtherSignaturefields.available`
- **OpenAPI description**: Should "Email address visibility" be available in the Settings to all gallery users? Can be configured on a global level with extern.multi.showOtherSignaturefields. For more details look at the description there.

### `settingsFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `settings.fav.default`
- **OpenAPI description**: Is the "Settings" action favored?

### `settingsFirmAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.firm.available`
- **OpenAPI description**: Should the gallery user be able to change their firm in the settings modal?

### `settingsForcecolorAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.forcecolor.available`
- **OpenAPI description**: Should the "Color" setting be available in the settings modal for gallery users?

### `settingsForcedSigfieldsAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.forced.sigfields.available`
- **OpenAPI description**: Should the "Mandatory Fields" setting be available in the settings modal for gallery users?

### `settingsImprintLinkAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.imprintLink.available`
- **OpenAPI description**: Should the "Imprint Link" setting be available in the settings modal for gallery users?

### `settingsLogoUploadAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.logo.upload.available`
- **OpenAPI description**: Should the "Firm Logo-upload" be available in the settings modal for gallery users?

### `settingsMaskAuditreportAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.mask.auditreport.available`
- **OpenAPI description**: Should "Email address masking" be available in the Settings to all gallery users?

### `settingsNameAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `settings.name.available`
- **OpenAPI description**: Should the gallery user be able to change their name in the settings modal?
- **Label**: Name in settings
- **Type**: bool
- **Feature description**: Controls whether the gallery user can change their name in the settings modal dialog. Default: false. When enabled, a name field appears in the settings modal allowing the user to update their display name. This name may be used in signature metadata, email communications, and the session UI. The settings modal must be enabled (settings.available=true) for this option to be accessible. This is particularly relevant for shared-device scenarios where different users sign on the same device and need to identify themselves, or for correcting auto-populated name information.

### `settingsNameValue`

Sources: features

- **Label**: Pre-fill signer name
- **Type**: text
- **globalProperty**: `settings.name.value`
- **Feature description**: Pre-populates the signer's name in the settings dialog. When set, the name field in the signing settings is pre-filled with this value, saving the signer from having to type their name manually. This is the name that appears on the visual signature in the PDF (depending on signature level and configuration). Combined with settingsNameAvailable=false, this locks the name so the signer cannot change it. Useful when the signer's identity is already known from the CRM or authentication system. The value should be the signer's full name as it should appear on the signature.

### `settingsOtpActivationAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.otp.activation.available`
- **OpenAPI description**: Should users be able to enable a two factor authentication (TOTP) for their account login?

### `settingsOwnMailasSenderAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.ownMailasSender.available`
- **OpenAPI description**: Should the "Use own e-mail as sender address" setting be available in the settings modal for gallery users?

### `settingsPlugintokenApiAvailable`

Sources: OpenAPI

- **globalProperty**: `settings.plugintoken.api.available`
- **OpenAPI description**: Should users created by API be able to create a plugin token. Has no relevance without license "module_pluginapi".

### `settingsPrivacyLinkAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.privacyLink.available`
- **OpenAPI description**: Should the "Privacy Link" setting be available in the settings modal for gallery users?

### `settingsQuicktipsResetAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.quicktips.reset.available`
- **OpenAPI description**: Should the Reset button for "Tutorial & Tips" be available in the settings modal for gallery users?

### `settingsRealLocationAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `settings.realLocation.available`
- **OpenAPI description**: Should the "Location" setting be available in the settings modal for gallery users? This setting requires that "Timestamp" is also available, otherwise nothing will be printed.
- **Label**: Location in settings
- **Type**: bool
- **Feature description**: Controls whether the 'Location' setting is available in the settings modal dialog. Default: false. When enabled, users can pre-configure their signing location in the settings, which is then used as the default value when realLocation.input.required prompts for location input. Important: this setting requires settings.timestamp.available to also be enabled, otherwise the location value will not be printed on signatures even if configured. The location setting works in conjunction with the timestamp to produce a complete 'Signed at [location] on [date]' annotation on the placed signature in the PDF.

### `settingsRealLocationValue`

Sources: features

- **Label**: Pre-fill signing location
- **Type**: text
- **globalProperty**: `settings.realLocation.value`
- **Feature description**: Pre-populates the signing location in the settings dialog. When set, the location field is pre-filled with this value (e.g., city name like 'Munich' or 'Berlin'). The location appears on the visual signature timestamp if signTimestampEnabled is active. Combined with settingsRealLocationAvailable=false, this locks the location so it cannot be changed. Useful when the signing location is predetermined (e.g., branch office address). If not set and settingsRealLocationInputRequired is enabled, the signer must enter their location manually before signing.

### `settingsRealnameAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.realname.available`
- **OpenAPI description**: Should the "Real Name" setting be available in the settings modal for gallery users?

### `settingsSaveForAutocompleteAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.saveForAutocomplete.available`
- **OpenAPI description**: Should the "E-Mail cache" setting be available in the settings modal for gallery users?            Works only if "mail.saveForAutocompleteFilter" is set.

### `settingsSignaturestampUploadAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.signaturestamp.upload.available`
- **OpenAPI description**: Should the "Signature upload" be available in the settings modal for gallery users?

### `settingsSubstituteAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.substitute.available`
- **OpenAPI description**: Should the option to select a substitute be available in the settings modal (for vacation etc.). This is only applies to processes owned by the user, not ones assigned by other users.

### `settingsTimestampAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `settings.timestamp.available`
- **OpenAPI description**: Should the "Timestamp" setting be available in the settings modal for gallery users?
- **Label**: Timestamp in settings
- **Type**: bool
- **Feature description**: Controls whether the 'Timestamp' setting is available in the settings modal dialog. Default: false. When enabled, users can configure timestamp display preferences for their signatures. The timestamp records the date and time when the signature was placed. This setting must be enabled for settings.realLocation.available to function, as the location is printed together with the timestamp on the signature. The timestamp setting controls the visual rendering of date/time information on the placed signature in the PDF document. Related to pdf.signature.date.enabled, which controls the underlying timestamp data inclusion.

### `settingsTrustlinkAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `settings.trustlink.available`
- **OpenAPI description**: Should the "Trustlink" setting be available in the settings modal for gallery users?

### `signAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `sign.available`
- **OpenAPI description**: Is the "Sign" mode available? true=automatic, false=not available
- **Label**: Signing
- **Type**: bool
- **Feature description**: Controls whether the 'Sign' mode is available in the PDF editor. When set to true (the default), signing mode is automatically activated, allowing users to place handwriting signatures, text signatures, or qualified electronic signatures on signature fields in the document. The signature type depends on the configured signatureLevel (SES, AES, AESSMS, or QES). Setting this to false disables the signing capability entirely, which may be useful for document-review-only scenarios. This property is fundamental to the signing workflow and interacts with most other signature-related properties.

### `systemcheckIgnoreconnect`

Sources: OpenAPI

- **globalProperty**: `systemcheck.ignoreconnect`
- **OpenAPI description**: Check the connection to the local instance. True will do the check, false will disable it.

### `transmissionUserdecisionGroup`

Sources: OpenAPI

- **globalProperty**: `transmission.userdecision.group`
- **OpenAPI description**: Will be removed in an upcoming version. Enables userdecision and no password option for members of the specified groups regardless of the password.transmission.userdecision setting. Multiple groups can be split by ",". For SAML the groups before mapping will be applied.

### `useradminPasswordExpirationDisplay`

Sources: OpenAPI

- **globalProperty**: `useradmin.passwordExpiration.display`
- **OpenAPI description**: Should the password expiration option be displayed in the useradmin panel?

### `vorgangDialogAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `vorgang.dialog.available`
- **OpenAPI description**: Show a menu for the process which allows various things like editing the name and changing settings.

### `vorgangsverwaltungActionAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `vorgangsverwaltung.action.available`
- **OpenAPI description**: Is the action "Process Manager" available?

### `vorgangsverwaltungActionFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `vorgangsverwaltung.action.fav.default`
- **OpenAPI description**: Is the "Process Manager" action favored?

### `vorgangsverwaltungDeleteAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `vorgangsverwaltung.delete.available`
- **OpenAPI description**: Should the "Delete" option be available in the process management?

### `vorgangsverwaltungDownloadBiometricDocsAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `vorgangsverwaltung.downloadBiometricDocs.available`
- **OpenAPI description**: Should the option "Download incl. signature data" be available in the process management?

### `vorgangsverwaltungExternDelayReminderAvailable`

Sources: OpenAPI | enum

- **globalProperty**: `vorgangsverwaltung.extern.delay.reminder.available`
- **OpenAPI description**: Should the "Send reminder" option be available in the process management? This option is shown only for processes where extern.per.sms=false and the statuses are "Signature requested" or "To edit".

### `vorgangsverwaltungPagesize`

Sources: OpenAPI | enum

- **globalProperty**: `vorgangsverwaltung.pagesize`
- **OpenAPI description**: How many results are shown on each page in the process management.

### `vorgangsverwaltungPrivateProcess`

Sources: OpenAPI | enum

- **globalProperty**: `vorgangsverwaltung.private.process`
- **OpenAPI description**: Can the user mark a shared process as private? A private process cannot be edited or downloaded. Visibility of private processes depends on vorgangsverwaltung.private.process.visible. Only affects processes shared in a group by enabling group.mapping.use.integrated.

### `vorgangsverwaltungPrivateProcessDefault`

Sources: OpenAPI

- **globalProperty**: `vorgangsverwaltung.private.process.default`
- **OpenAPI description**: Initial private value for new processes. Only works if vorgangsverwaltung.private.process is enabled.

### `vorgangsverwaltungPrivateProcessGroup`

Sources: OpenAPI | enum

- **globalProperty**: `vorgangsverwaltung.private.process.group`
- **OpenAPI description**: Only users with a group that matches this regular expression can mark their processes as private. Allows all users if empty. Only works if vorgangsverwaltung.private.process is enabled.

### `vorgangsverwaltungPrivateProcessVisible`

Sources: OpenAPI

- **globalProperty**: `vorgangsverwaltung.private.process.visible`
- **OpenAPI description**: Is a process marked private still visible, but cannot be edited or downloaded. Only works if vorgangsverwaltung.private.process is enabled.

### `zoomAvailable`

Sources: OpenAPI | enum | features

- **globalProperty**: `zoom.available`
- **OpenAPI description**: Is the "Zoom in, zoom out" action available?
- **Label**: Zoom
- **Type**: bool
- **Feature description**: Controls whether zoom in/out controls are available in the PDF editor toolbar. When enabled, users can adjust the document magnification level for better readability or to get an overview of the full page. Default: true. Zoom controls include both zoom-in and zoom-out buttons. On touch-enabled devices, pinch-to-zoom may still work independently of this setting depending on the browser. This property is particularly useful for detailed document review and for users working on smaller screens where the default zoom level may not provide adequate readability.

### `zoomFavDefault`

Sources: OpenAPI | enum

- **globalProperty**: `zoom.fav.default`
- **OpenAPI description**: Is the action "Zoom in, zoom out" favored?
