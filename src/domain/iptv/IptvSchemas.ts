import { z } from "zod";

export const IptvCountrySchema = z.object({
	name: z.string(),
	code: z.string(),
	flag: z.string(),
	languages: z.array(z.string()).optional(),
});

export const IptvCountriesResponseSchema = z.array(IptvCountrySchema);

export const IptvChannelSchema = z.object({
	tvgId: z.string().nullable().optional(),
	name: z.string(),
	logo: z.string().nullable().optional(),
	category: z.string().nullable().optional(),
	url: z.string(),
});

export const IptvChannelsResponseSchema = z.array(IptvChannelSchema);

export type IptvCountry = z.infer<typeof IptvCountrySchema>;
export type IptvChannel = z.infer<typeof IptvChannelSchema>;
