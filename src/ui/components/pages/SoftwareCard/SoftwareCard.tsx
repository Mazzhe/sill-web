import { Fragment, useEffect, useMemo } from "react";
import { DirectoryHeader } from "onyxia-ui/DirectoryHeader";
import { Icon, makeStyles } from "ui/theme";
import { Card } from "onyxia-ui/Card";
import { Button } from "ui/theme";
import { declareComponentKeys } from "i18nifty";
import { useTranslation, useLang } from "ui/i18n";
import { Link } from "type-route";
import { DescriptiveField } from "ui/components/shared/DescriptiveField";
import { useResolveLocalizedString } from "ui/i18n";
import { exclude } from "tsafe/exclude";
import { capitalize } from "tsafe/capitalize";
import { getFormattedDate } from "ui/useMoment";
import { Tag } from "onyxia-ui/Tag";
import { Tooltip } from "onyxia-ui/Tooltip";
import { useDomRect } from "powerhooks/useDomRect";
import MuiLink from "@mui/material/Link";
import { ReferentDialogs } from "ui/components/shared/ReferentDialogs";
import { useConst } from "powerhooks/useConst";
import { Evt } from "evt";
import { useConstCallback } from "powerhooks/useConstCallback";
import { assert } from "tsafe/assert";
import type { ReferentDialogsProps } from "ui/components/shared/ReferentDialogs";
import { useSelector, useThunks, selectors } from "ui/coreApi";
import type { Route } from "type-route";
import { createGroup } from "type-route";
import { routes } from "ui/routes";
import { useSplashScreen } from "onyxia-ui";
import memoize from "memoizee";
import { CustomTag } from "ui/components/shared/Tags/CustomTag";
import { DereferenceSoftwareDialog } from "./DereferenceSoftwareDialog";
import type { DereferenceSoftwareDialogProps } from "./DereferenceSoftwareDialog";
import { Text } from "ui/theme";

//TODO: We should have a dedicated usecase for this page.

SoftwareCard.routeGroup = createGroup([routes.card]);

type PageRoute = Route<typeof SoftwareCard.routeGroup>;

SoftwareCard.getDoRequireUserLoggedIn = () => false;

export type Props = {
    className?: string;
    route: PageRoute;
};

export function SoftwareCard(props: Props) {
    const { className, route } = props;

    const { t } = useTranslation({ SoftwareCard });

    const { resolveLocalizedString } = useResolveLocalizedString();

    const { showSplashScreen, hideSplashScreen } = useSplashScreen();

    const catalogState = useSelector(state => state.catalog);

    const readyState =
        catalogState.stateDescription === "ready" ? catalogState : undefined;

    const { catalogThunks, userAuthenticationThunks } = useThunks();

    useEffect(() => {
        switch (catalogState.stateDescription) {
            case "not fetched":
                if (!catalogState.isFetching) {
                    showSplashScreen({ "enableTransparency": true });
                    catalogThunks.fetchCatalog();
                }
                break;
            case "ready":
                hideSplashScreen();
                break;
        }
    }, [catalogState.stateDescription]);

    useEffect(() => {
        const { isProcessing } = readyState ?? {};

        if (isProcessing === undefined) {
            return;
        }

        if (isProcessing) {
            showSplashScreen({
                "enableTransparency": true,
            });
        } else {
            hideSplashScreen();
        }
    }, [readyState?.isProcessing]);

    const onGoBack = useConstCallback(() => routes.catalog().push());

    const { imgRef, isBanner, imgWidth } = (function useClosure() {
        const {
            ref: imgRef,
            domRect: { height, width: imgWidth },
        } = useDomRect();

        const isBanner =
            imgWidth === 0 || height === 0 ? undefined : imgWidth > height * 1.7;

        return { imgRef, isBanner, imgWidth };
    })();

    const evtReferentDialogAction = useConst(() =>
        Evt.create<ReferentDialogsProps["evtAction"]>(),
    );

    const evtDereferenceSoftwareDialogOpen = useConst(() => Evt.create<void>());

    const onShowReferentClick = useConstCallback(async () => {
        if (referents === undefined) {
            userAuthenticationThunks.login({ "doesCurrentHrefRequiresAuth": false });
            return;
        }

        evtReferentDialogAction.post("open");
    });

    const { classes, cx, css } = useStyles({ imgWidth });

    const softwareNameOrSoftwareId = (() => {
        const { name: softwareNameOrSoftwareIdAsString } = route.params;

        if (softwareNameOrSoftwareIdAsString === undefined) {
            return undefined;
        }

        return /^[0-9]+$/.test(softwareNameOrSoftwareIdAsString)
            ? parseInt(softwareNameOrSoftwareIdAsString)
            : softwareNameOrSoftwareIdAsString;
    })();

    useEffect(() => {
        if (typeof softwareNameOrSoftwareId !== "number") {
            return;
        }

        const { softwares } = readyState ?? {};

        if (softwares === undefined) {
            return;
        }

        const software = softwares.find(
            ({ name, id }) =>
                softwareNameOrSoftwareId ===
                (typeof softwareNameOrSoftwareId === "number" ? id : name),
        );

        if (software === undefined) {
            routes.fourOhFour().replace();
            return;
        }

        routes.card({ "name": software.name }).replace();
    }, [softwareNameOrSoftwareId, readyState?.softwares]);

    const getFormLink = useConst(() =>
        memoize((softwareId: number | undefined) => routes.form({ softwareId }).link),
    );

    const { softwareNameBySoftwareId } = useSelector(
        selectors.catalog.softwareNameBySoftwareId,
    );

    const openLinkBySoftwareId = useMemo(() => {
        if (softwareNameBySoftwareId === undefined) {
            return undefined;
        }

        const openLinkBySoftwareId: Record<number, Link> = {};

        Object.entries(softwareNameBySoftwareId).forEach(([id, name]) => {
            openLinkBySoftwareId[parseInt(id)] = routes.card({
                "name": name,
            }).link;
        });

        return openLinkBySoftwareId;
    }, [softwareNameBySoftwareId]);

    const onDeclareReferentAnswer = useConstCallback<ReferentDialogsProps["onAnswer"]>(
        ({ isExpert, useCaseDescription, isPersonalUse }) => {
            assert(software !== undefined);
            catalogThunks.declareUserReferent({
                isExpert,
                "softwareId": software.id,
                useCaseDescription,
                isPersonalUse,
            });
        },
    );

    const onUserNoLongerReferent = useConstCallback(() => {
        assert(software !== undefined);
        catalogThunks.userNoLongerReferent({
            "softwareId": software.id,
        });
    });

    const onDereferenceSoftware = useConstCallback<
        DereferenceSoftwareDialogProps["onAnswer"]
    >(({ reason, lastRecommendedVersion }) => {
        assert(software !== undefined);

        catalogThunks.dereferenceSoftware({
            "softwareId": software.id,
            reason,
            lastRecommendedVersion,
        });
    });

    const { lang } = useLang();

    //NOTE: We expect the route param to be the name of the software, if
    //it's the id we replace in the above effect.
    if (typeof softwareNameOrSoftwareId === "number") {
        return null;
    }

    if (readyState === undefined) {
        return null;
    }

    assert(openLinkBySoftwareId !== undefined);
    assert(softwareNameBySoftwareId !== undefined);

    const software = readyState.softwares.find(
        ({ name }) => softwareNameOrSoftwareId === name,
    );

    if (software === undefined) {
        routes.fourOhFour().replace();
        return null;
    }

    const { referents, userIndex } =
        readyState.referentsBySoftwareId?.[software.id] ?? {};

    const softwareFunction = capitalize(
        [lang === "fr" ? undefined : software.wikidataData?.description]
            .filter(exclude(undefined))
            .map(resolveLocalizedString)[0] ?? software.function,
    );

    const referencedSincePrettyPrint = getFormattedDate({
        "time": software.referencedSinceTime,
        lang,
    });

    const editLink =
        readyState.referentsBySoftwareId === undefined
            ? undefined
            : readyState.referentsBySoftwareId[software.id].userIndex !== undefined
            ? getFormLink(software.id)
            : undefined;

    return (
        <div className={cx(classes.root, className)}>
            <DirectoryHeader
                classes={{
                    "imageWrapper": classes.imageWrapper,
                }}
                onGoBack={onGoBack}
                title={
                    <>
                        {!isBanner && software.name}
                        {software.isStillInObservation && (
                            <>
                                &nbsp; &nbsp;
                                <Tag
                                    className={classes.warningTag}
                                    text={"En observation"}
                                />
                            </>
                        )}
                        {software.isFromFrenchPublicService && (
                            <>
                                &nbsp; &nbsp;
                                <Tooltip
                                    title={"Développé par le service public français"}
                                >
                                    <span>🐓</span>
                                </Tooltip>
                            </>
                        )}
                        {software.dereferencing !== undefined && (
                            <>
                                &nbsp; &nbsp;
                                <Text typo="body 1" className={classes.dereferencedText}>
                                    {t("software dereferenced", software.dereferencing)}
                                </Text>
                            </>
                        )}
                    </>
                }
                subtitle={!isBanner && softwareFunction}
                image={
                    software?.wikidataData?.logoUrl !== undefined ? (
                        <img
                            ref={imgRef}
                            src={software.wikidataData.logoUrl}
                            alt=""
                            className={css({ "height": "100%" })}
                        />
                    ) : (
                        <Icon
                            iconId="airplay"
                            className={css({ "height": "100%", "width": "100%" })}
                        />
                    )
                }
            />
            {editLink !== undefined && (
                <Button
                    {...editLink}
                    doOpenNewTabIfHref={false}
                    className={classes.formLinkButton}
                >
                    {t("update software information")}
                </Button>
            )}
            {userIndex !== undefined && (
                <Button
                    startIcon="delete"
                    className={classes.dereferenceButton}
                    variant="secondary"
                    onClick={() => evtDereferenceSoftwareDialogOpen.post()}
                >
                    {t("dereference from SILL")}
                </Button>
            )}
            <DereferenceSoftwareDialog
                evtOpen={evtDereferenceSoftwareDialogOpen}
                softwareName={software.name}
                onAnswer={onDereferenceSoftware}
            />
            <Card className={classes.card}>
                <DescriptiveField
                    type="text"
                    title={t("software name")}
                    text={capitalize(
                        [software.wikidataData?.label]
                            .filter(exclude(undefined))
                            .map(resolveLocalizedString)[0] ?? software.name,
                    )}
                />
                <DescriptiveField
                    type="text"
                    title={t("software function")}
                    text={softwareFunction}
                />
                {software.testUrls.length !== 0 && (
                    <DescriptiveField
                        type="text"
                        title={t("test url")}
                        helperText={t("test url helper")}
                        text={
                            <Button
                                href={
                                    (assert(
                                        software.testUrls.length === 1,
                                        "Implement view for multiple urls",
                                    ),
                                    software.testUrls[0].url)
                                }
                                doOpenNewTabIfHref={true}
                                variant="ternary"
                            >
                                {t("launch")}
                            </Button>
                        }
                    />
                )}
                <DescriptiveField
                    type="text"
                    title={t("sill id")}
                    helperText={t("sill id helper")}
                    text={`${software.id}`}
                />
                {software.tags !== undefined && software.tags.length !== 0 && (
                    <DescriptiveField
                        type="text"
                        title={t("tags")}
                        helperText={t("tags helper")}
                        text={software.tags.map(tag => (
                            <CustomTag key={tag} className={classes.tag} tag={tag} />
                        ))}
                    />
                )}
                <DescriptiveField
                    type="text"
                    title={t("in sill from date")}
                    text={referencedSincePrettyPrint}
                />
                <DescriptiveField
                    type="text"
                    title={t("dev by public service")}
                    text={software.isFromFrenchPublicService ? "Oui" : "Non"}
                />
                <DescriptiveField
                    type="text"
                    title={t("present in support contract")}
                    helperText={
                        <>
                            {t("learn more about the")}&nbsp;
                            <MuiLink href="https://communs.numerique.gouv.fr/utiliser/marches-interministeriels-support-expertise-logiciels-libres/">
                                {t("MISEULL")}
                            </MuiLink>
                        </>
                    }
                    text={t(software.isPresentInSupportContract ? "yes" : "no")}
                />
                {software.wikidataData?.sourceUrl && (
                    <DescriptiveField
                        type="text"
                        title={t("repo")}
                        text={
                            <MuiLink
                                target="_blank"
                                href={software.wikidataData.sourceUrl}
                            >
                                {software.wikidataData.sourceUrl
                                    .replace(/^https:\/\//, "")
                                    .replace(/\/$/, "")}
                            </MuiLink>
                        }
                    />
                )}
                {software.wikidataData?.websiteUrl && (
                    <DescriptiveField
                        type="text"
                        title={t("website of the software")}
                        text={
                            <MuiLink
                                target="_blank"
                                href={software.wikidataData.websiteUrl}
                            >
                                {software.wikidataData.websiteUrl
                                    .replace(/^https:\/\//, "")
                                    .replace(/\/$/, "")}
                            </MuiLink>
                        }
                    />
                )}
                <DescriptiveField
                    type="text"
                    title={t("minimal version")}
                    helperText={t("minimal version helper")}
                    text={software.versionMin}
                />
                <DescriptiveField
                    type="text"
                    title={t("license")}
                    text={software.license}
                />
                <DescriptiveField
                    type="text"
                    title={t("referents")}
                    helperText={t("referents helper")}
                    text={
                        <Button onClick={onShowReferentClick} variant="ternary">
                            {t("see referents")}
                        </Button>
                    }
                />
                {software.parentSoftware?.isKnown && (
                    <DescriptiveField
                        type="text"
                        title={t("parent software")}
                        helperText={t("parent software helper")}
                        text={
                            <MuiLink
                                {...openLinkBySoftwareId[
                                    software.parentSoftware.softwareId
                                ]}
                            >
                                {
                                    softwareNameBySoftwareId[
                                        software.parentSoftware.softwareId
                                    ]
                                }
                            </MuiLink>
                        }
                    />
                )}
                {software.alikeSoftwares !== undefined &&
                    software.alikeSoftwares.length !== 0 && (
                        <DescriptiveField
                            type="text"
                            title={t("alike softwares")}
                            helperText={t("alike softwares helper")}
                            text={software.alikeSoftwares.map((softwareRef, i) => (
                                <Fragment key={i}>
                                    {softwareRef.isKnown ? (
                                        <MuiLink
                                            {...openLinkBySoftwareId[
                                                softwareRef.softwareId
                                            ]}
                                        >
                                            {
                                                softwareNameBySoftwareId[
                                                    softwareRef.softwareId
                                                ]
                                            }
                                        </MuiLink>
                                    ) : (
                                        softwareRef.softwareName
                                    )}{" "}
                                    &nbsp;
                                </Fragment>
                            ))}
                        />
                    )}
                <DescriptiveField
                    type="text"
                    title={t("workstation")}
                    helperText={t("workstation helper")}
                    text={software.agentWorkstation ? "Oui" : "Non"}
                />
                {!!software.wikidataData?.developers.length && (
                    <DescriptiveField
                        type="text"
                        title={t("authors")}
                        helperText={t("authors helper")}
                        text={software.wikidataData.developers.map(developer => (
                            <Fragment key={developer.id}>
                                <MuiLink
                                    key={developer.id}
                                    href={`https://www.wikidata.org/wiki/${developer.id}`}
                                    target="_blank"
                                >
                                    {developer.name}
                                </MuiLink>
                                &nbsp;
                            </Fragment>
                        ))}
                    />
                )}

                {!!software.comptoirDuLibreSoftware?.providers.length && (
                    <DescriptiveField
                        type="text"
                        title={t("service provider")}
                        helperText={t("service provider helper")}
                        text={
                            <MuiLink
                                href={`https://comptoir-du-libre.org/fr/softwares/servicesProviders/${software.comptoirDuLibreSoftware.id}`}
                            >
                                {t("total service provider", {
                                    "howMany": `${software.comptoirDuLibreSoftware.providers.length}`,
                                })}
                            </MuiLink>
                        }
                    />
                )}
                {software.comptoirDuLibreSoftware !== undefined && (
                    <DescriptiveField
                        type="text"
                        title={t("comptoir page")}
                        helperText={t("comptoir page helper")}
                        text={
                            <MuiLink
                                href={`https://comptoir-du-libre.org/fr/softwares/${software.comptoirDuLibreSoftware.id}`}
                            >
                                {t("see on comptoir")}
                            </MuiLink>
                        }
                    />
                )}
                {software.wikidataData !== undefined && (
                    <DescriptiveField
                        type="text"
                        title={t("wikidata page")}
                        helperText={t("wikidata page helper")}
                        text={
                            <MuiLink
                                href={`https://www.wikidata.org/wiki/${software.wikidataData.id}`}
                            >
                                {t("see on wikidata")}
                            </MuiLink>
                        }
                    />
                )}
                {software.workshopUrls.length !== 0 && (
                    <DescriptiveField
                        type="text"
                        title={t("workshops replay")}
                        helperText={
                            <>
                                {t("workshops replay helper")}&nbsp;
                                <MuiLink href="https://communs.numerique.gouv.fr/ateliers">
                                    {t("see all workshops")}
                                </MuiLink>
                            </>
                        }
                        text={software.workshopUrls.map((url, i) => (
                            <Fragment key={url}>
                                <MuiLink key={url} href={url} target="_blank">
                                    {t("workshop", { "n": `${i + 1}` })}
                                </MuiLink>
                                &nbsp;
                            </Fragment>
                        ))}
                    />
                )}
                {software.useCaseUrls.length !== 0 && (
                    <DescriptiveField
                        type="text"
                        title={t("use cases")}
                        helperText={t("use cases helper")}
                        text={software.useCaseUrls.map((url, i) => (
                            <Fragment key={url}>
                                <MuiLink key={url} href={url} target="_blank">
                                    {t("use case", { "n": `${i + 1}` })}
                                </MuiLink>
                                &nbsp;
                            </Fragment>
                        ))}
                    />
                )}
            </Card>
            <ReferentDialogs
                referents={referents}
                userIndexInReferents={userIndex}
                evtAction={evtReferentDialogAction}
                onAnswer={onDeclareReferentAnswer}
                onUserNoLongerReferent={onUserNoLongerReferent}
                softwareName={software.name}
            />
        </div>
    );
}

const useStyles = makeStyles<{ imgWidth: number }>({
    "name": { SoftwareCard },
})((theme, { imgWidth }) => ({
    "root": {
        "marginBottom": theme.spacing(3),
    },
    "card": {
        "paddingTop": theme.spacing(2),
    },
    "formLinkButton": {
        ...theme.spacing.topBottom("margin", 4),
    },
    "warningTag": {
        "backgroundColor": theme.colors.useCases.alertSeverity.warning.main,
        "& > p": {
            "color": theme.colors.palette.dark.main,
        },
    },
    "imageWrapper": {
        "width": imgWidth,
    },
    "tag": {
        "marginRight": theme.spacing(1),
    },
    "dereferenceButton": {
        "marginLeft": theme.spacing(3),
    },
    "dereferencedText": {
        "color": theme.colors.useCases.alertSeverity.error.main,
    },
}));

export const { i18n } = declareComponentKeys<
    | "update software information"
    | "software name"
    | "software function"
    | "sill id"
    | "sill id helper"
    | "in sill from date"
    | "dev by public service"
    | "present in support contract"
    | "learn more about the"
    | "MISEULL"
    | "yes"
    | "no"
    | "repo"
    | "website of the software"
    | "minimal version"
    | "minimal version helper"
    | "referents"
    | "referents helper"
    | "see referents"
    | "parent software"
    | "parent software helper"
    | "alike softwares"
    | "alike softwares helper"
    | "workstation"
    | "workstation helper"
    | "authors"
    | "authors helper"
    | "service provider"
    | "service provider helper"
    | { K: "total service provider"; P: { howMany: string } }
    | "comptoir page"
    | "comptoir page helper"
    | "see on comptoir"
    | "wikidata page"
    | "wikidata page helper"
    | "see on wikidata"
    | "license"
    | "workshops replay"
    | "workshops replay helper"
    | "see all workshops"
    | "test url"
    | "test url helper"
    | "launch"
    | { K: "workshop"; P: { n: string } }
    | "use cases"
    | "use cases helper"
    | { K: "use case"; P: { n: string } }
    | "tags"
    | "tags helper"
    | "dereference from SILL"
    | {
          K: "software dereferenced";
          P: { lastRecommendedVersion?: string; reason?: string };
      }
>()({ SoftwareCard });
