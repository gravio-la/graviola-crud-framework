import {
  and,
  Categorization,
  categorizationHasCategory,
  Category,
  getAjv,
  isVisible,
  JsonFormsRendererRegistryEntry,
  optionIs,
  RankedTester,
  rankWith,
  StatePropsOfLayout,
  uiTypeIs,
} from "@jsonforms/core";
import {
  AjvProps,
  MaterialLayoutRenderer,
  MaterialLayoutRendererProps,
} from "@jsonforms/material-renderers";
import { useJsonForms, withJsonFormsLayoutProps } from "@jsonforms/react";
import { KeyboardArrowLeft, KeyboardArrowRight } from "@mui/icons-material";
import {
  Box,
  Button,
  Grid,
  MobileStepper,
  Step,
  StepButton,
  Stepper,
  Typography,
} from "@mui/material";
import merge from "lodash-es/merge";
import { useTranslation } from "next-i18next";
import { type ComponentType, useCallback, useState } from "react";

export const materialCategorizationStepperTester: RankedTester = rankWith(
  4,
  and(
    uiTypeIs("Categorization"),
    categorizationHasCategory,
    optionIs("variant", "stepper"),
  ),
);

export interface CategorizationStepperState {
  activeCategory: number;
}

export interface MaterialCategorizationStepperLayoutRendererProps
  extends StatePropsOfLayout,
    AjvProps {
  data: any;
  actionContainer?: HTMLElement;
}

export const MaterialCategorizationStepperLayout = (
  props: MaterialCategorizationStepperLayoutRendererProps,
) => {
  const [activeCategory, setActiveCategory] = useState<number>(0);

  const handleStep = (step: number) => {
    setActiveCategory(step);
  };

  const {
    data,
    path,
    renderers,
    schema,
    uischema,
    visible,
    cells,
    config,
    ajv,
  } = props;
  const categorization = uischema as Categorization;
  const appliedUiSchemaOptions = merge({}, config, uischema.options);
  const buttonNextStyle = {};
  const buttonStyle = {
    marginRight: "1em",
  };
  const categories = categorization.elements.filter((category: Category) =>
    isVisible(category, data, undefined, ajv as any),
  );
  const { t } = useTranslation();
  const childProps: MaterialLayoutRendererProps = {
    elements: categories[activeCategory].elements,
    schema,
    path,
    direction: "column",
    visible,
    renderers,
    cells,
  };
  const handleNext = useCallback(
    () => handleStep(activeCategory + 1),
    [activeCategory],
  );
  const handleBack = useCallback(
    () => handleStep(activeCategory - 1),
    [activeCategory],
  );

  if (!visible) {
    return null;
  }

  return (
    <Box>
      <Grid
        container
        spacing={4}
        wrap={"nowrap"}
        direction={{ md: "row", xs: "column" }}
      >
        <Grid item xs={2}>
          <Stepper
            activeStep={activeCategory}
            nonLinear
            orientation={"vertical"}
            sx={{
              paddingTop: (theme) => theme.spacing(2),
              display: { xs: "none", md: "flex" },
            }}
          >
            {categories.map((e: Category, idx: number) => (
              <Step key={e.label}>
                <StepButton onClick={() => handleStep(idx)}>
                  {e.label}
                </StepButton>
              </Step>
            ))}
          </Stepper>
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            <MobileStepper
              variant="text"
              steps={categories.length}
              position="static"
              activeStep={activeCategory}
              nextButton={
                <Button
                  size="small"
                  onClick={handleNext}
                  disabled={activeCategory >= categories.length - 1}
                >
                  {t("next")}
                  <KeyboardArrowRight />
                </Button>
              }
              backButton={
                <Button
                  size="small"
                  onClick={handleBack}
                  disabled={activeCategory <= 0}
                >
                  <KeyboardArrowLeft />
                  {t("back")}
                </Button>
              }
            />
            <Typography variant="h3">
              {categories[activeCategory].label}
            </Typography>
          </Box>
        </Grid>
        <Grid
          item
          xs={10}
          sx={(theme) => ({
            marginTop: 4,
            [theme.breakpoints.down("md")]: {
              marginTop: 0,
            },
          })}
        >
          <div>
            <MaterialLayoutRenderer {...childProps} />
          </div>
        </Grid>
      </Grid>
      {Boolean(appliedUiSchemaOptions.showNavButtons) && (
        <Box
          sx={{
            width: "100%",
            display: { xs: "none", md: "flex" },
            justifyContent: "space-between",
          }}
        >
          <Button
            style={buttonStyle}
            color="secondary"
            variant="contained"
            disabled={activeCategory <= 0}
            onClick={handleBack}
          >
            zurück
          </Button>
          <Button
            style={buttonNextStyle}
            variant="contained"
            color="primary"
            disabled={activeCategory >= categories.length - 1}
            onClick={handleNext}
          >
            weiter
          </Button>
        </Box>
      )}
    </Box>
  );
};
const withAjvProps = <P extends {}>(Component: ComponentType<AjvProps & P>) => {
  const ComponentWithAjv = (props: P) => {
    const ctx = useJsonForms();
    const ajv = getAjv({ jsonforms: { ...ctx } }) as unknown as AjvProps["ajv"];

    return <Component {...props} ajv={ajv} />;
  };
  return ComponentWithAjv;
};

export const MaterialCategorizationStepperLayoutRegistryEntry: JsonFormsRendererRegistryEntry =
  {
    tester: materialCategorizationStepperTester,
    renderer: withJsonFormsLayoutProps(
      withAjvProps(MaterialCategorizationStepperLayout),
    ),
  };
