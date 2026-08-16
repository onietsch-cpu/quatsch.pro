import { isProviderConfigured } from '../services/ai-provider.js';

export default async (req, res) => {
	res.setHeader('Cache-Control', 'no-store');
	res.json({ status: 'ok', aiProviderConfigured: isProviderConfigured() });
};
