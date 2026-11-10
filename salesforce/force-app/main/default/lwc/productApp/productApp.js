import { LightningElement, api } from 'lwc';
import DEFAULT_APP_URL from '@salesforce/label/c.Product_App_URL';

/**
 * Hosts the React Product Manager (deployed on Vercel) in an iframe.
 * The URL comes from the Product_App_URL custom label, or from the appUrl
 * property set in Lightning App Builder.
 */
export default class ProductApp extends LightningElement {
    /** Overrides the Product_App_URL custom label, e.g. https://localhost:5173 for local dev. */
    @api appUrl;
    /** Frame height in pixels. */
    @api height = 720;
    /** Provided automatically on Product2 record pages; opens that product's detail view. */
    @api recordId;

    get src() {
        const base = this.appUrl || DEFAULT_APP_URL;
        try {
            const url = new URL(base);
            url.searchParams.set('embedded', '1');
            if (this.recordId) {
                url.hash = `/products/${this.recordId}`;
            }
            return url.toString();
        } catch {
            return null;
        }
    }

    get frameStyle() {
        return `height: ${Number(this.height) || 720}px;`;
    }
}
